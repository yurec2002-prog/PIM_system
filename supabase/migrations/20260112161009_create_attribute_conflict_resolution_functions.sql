/*
  # Attribute Conflict Resolution and Priority Functions

  1. Functions
    - `set_active_attribute_value()` - Switch which value is active
    - `set_manual_override()` - Mark value as manually overridden by manager
    - `resolve_conflicts_for_sku()` - Auto-resolve conflicts using priority rules
    - `get_attribute_conflicts()` - Get all SKUs with attribute conflicts

  2. Priority Rules
    - Sandi (priority 100) > Manual Override (priority 90) > Other Suppliers (priority 50)
    - Manual override always wins
*/

-- =====================================================
-- 1) Set Active Attribute Value (Switch Source)
-- =====================================================
CREATE OR REPLACE FUNCTION set_active_attribute_value(
  p_internal_sku_id uuid,
  p_master_attr_id uuid,
  p_target_value_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_target_value RECORD;
BEGIN
  -- Get target value info
  SELECT * INTO v_target_value
  FROM sku_attribute_values
  WHERE id = p_target_value_id
    AND internal_sku_id = p_internal_sku_id
    AND master_attr_id = p_master_attr_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Value not found';
  END IF;
  
  -- Deactivate all other values for this SKU+attribute
  UPDATE sku_attribute_values
  SET is_active = false
  WHERE internal_sku_id = p_internal_sku_id
    AND master_attr_id = p_master_attr_id
    AND id != p_target_value_id;
  
  -- Activate target value
  UPDATE sku_attribute_values
  SET is_active = true
  WHERE id = p_target_value_id;
  
  RETURN true;
END;
$$;

-- =====================================================
-- 2) Set Manual Override
-- =====================================================
CREATE OR REPLACE FUNCTION set_manual_override(
  p_internal_sku_id uuid,
  p_master_attr_id uuid,
  p_value text,
  p_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_value_id uuid;
  v_sandi_supplier_id uuid;
BEGIN
  -- Get Sandi supplier ID (for source tracking)
  SELECT id INTO v_sandi_supplier_id
  FROM suppliers
  WHERE code = 'sandi' OR LOWER(name) LIKE '%sandi%'
  LIMIT 1;
  
  -- Deactivate all existing values
  UPDATE sku_attribute_values
  SET is_active = false
  WHERE internal_sku_id = p_internal_sku_id
    AND master_attr_id = p_master_attr_id;
  
  -- Insert or update manual override value
  INSERT INTO sku_attribute_values (
    internal_sku_id,
    master_attr_id,
    value,
    value_normalized,
    source_supplier_id,
    source_type,
    is_active,
    is_manual_override,
    priority_score
  ) VALUES (
    p_internal_sku_id,
    p_master_attr_id,
    p_value,
    p_value,
    v_sandi_supplier_id, -- attributed to Sandi by default
    'manual',
    true,
    true,
    90 -- manual override has priority 90 (less than Sandi's 100 but more than others)
  )
  ON CONFLICT (internal_sku_id, master_attr_id, source_supplier_id)
  WHERE is_manual_override = true
  DO UPDATE SET
    value = EXCLUDED.value,
    value_normalized = EXCLUDED.value_normalized,
    is_active = true,
    updated_at = now()
  RETURNING id INTO v_value_id;
  
  RETURN v_value_id;
END;
$$;

-- =====================================================
-- 3) Resolve Conflicts Using Priority Rules
-- =====================================================
CREATE OR REPLACE FUNCTION resolve_conflicts_for_sku(p_internal_sku_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_resolved_count integer := 0;
  v_attr RECORD;
BEGIN
  -- For each attribute with multiple values
  FOR v_attr IN
    SELECT 
      master_attr_id,
      COUNT(*) as value_count
    FROM sku_attribute_values
    WHERE internal_sku_id = p_internal_sku_id
    GROUP BY master_attr_id
    HAVING COUNT(*) > 1
  LOOP
    -- Deactivate all values
    UPDATE sku_attribute_values
    SET is_active = false
    WHERE internal_sku_id = p_internal_sku_id
      AND master_attr_id = v_attr.master_attr_id;
    
    -- Activate highest priority value
    -- Priority: manual override > Sandi > others
    UPDATE sku_attribute_values
    SET is_active = true
    WHERE id = (
      SELECT id
      FROM sku_attribute_values
      WHERE internal_sku_id = p_internal_sku_id
        AND master_attr_id = v_attr.master_attr_id
      ORDER BY 
        CASE WHEN is_manual_override THEN 1 ELSE 2 END,
        priority_score DESC,
        created_at ASC
      LIMIT 1
    );
    
    v_resolved_count := v_resolved_count + 1;
  END LOOP;
  
  RETURN v_resolved_count;
END;
$$;

-- =====================================================
-- 4) Get All Attribute Conflicts
-- =====================================================
CREATE OR REPLACE FUNCTION get_attribute_conflicts(
  p_category_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS TABLE(
  internal_sku_id uuid,
  internal_sku text,
  category_name text,
  master_attr_id uuid,
  attr_name text,
  conflict_count integer,
  values_json jsonb
)
LANGUAGE sql
AS $$
  SELECT 
    sav.internal_sku_id,
    isk.internal_sku,
    ic.name as category_name,
    sav.master_attr_id,
    mad.name_ru as attr_name,
    COUNT(DISTINCT sav.value) as conflict_count,
    jsonb_agg(
      jsonb_build_object(
        'value', sav.value,
        'supplier_name', s.name,
        'is_active', sav.is_active,
        'is_manual_override', sav.is_manual_override,
        'priority_score', sav.priority_score
      ) ORDER BY sav.priority_score DESC
    ) as values_json
  FROM sku_attribute_values sav
  JOIN internal_skus isk ON isk.id = sav.internal_sku_id
  JOIN internal_categories ic ON ic.id = isk.internal_category_id
  JOIN master_attribute_dictionary mad ON mad.id = sav.master_attr_id
  JOIN suppliers s ON s.id = sav.source_supplier_id
  WHERE (p_category_id IS NULL OR isk.internal_category_id = p_category_id)
  GROUP BY sav.internal_sku_id, isk.internal_sku, ic.name, sav.master_attr_id, mad.name_ru
  HAVING COUNT(DISTINCT sav.value) > 1
  ORDER BY conflict_count DESC
  LIMIT p_limit;
$$;

-- =====================================================
-- 5) Bulk Resolve All Conflicts
-- =====================================================
CREATE OR REPLACE FUNCTION resolve_all_conflicts()
RETURNS TABLE(
  resolved_skus integer,
  resolved_attributes integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_sku_id uuid;
  v_resolved_skus integer := 0;
  v_resolved_attrs integer := 0;
BEGIN
  -- Resolve conflicts for all SKUs
  FOR v_sku_id IN
    SELECT DISTINCT internal_sku_id
    FROM sku_attribute_values
  LOOP
    v_resolved_attrs := v_resolved_attrs + resolve_conflicts_for_sku(v_sku_id);
    v_resolved_skus := v_resolved_skus + 1;
  END LOOP;
  
  RETURN QUERY SELECT v_resolved_skus, v_resolved_attrs;
END;
$$;

-- =====================================================
-- 6) Get Attribute Statistics
-- =====================================================
CREATE OR REPLACE FUNCTION get_attribute_statistics()
RETURNS TABLE(
  total_master_attributes integer,
  total_sku_values integer,
  total_conflicts integer,
  manual_overrides integer,
  sandi_values integer,
  other_supplier_values integer,
  categories_with_schemas integer
)
LANGUAGE sql
AS $$
  SELECT 
    (SELECT COUNT(*)::integer FROM master_attribute_dictionary) as total_master_attributes,
    (SELECT COUNT(*)::integer FROM sku_attribute_values) as total_sku_values,
    (SELECT COUNT(*)::integer FROM sku_attribute_values WHERE has_conflict = true) as total_conflicts,
    (SELECT COUNT(*)::integer FROM sku_attribute_values WHERE is_manual_override = true) as manual_overrides,
    (SELECT COUNT(*)::integer FROM sku_attribute_values sav 
     JOIN suppliers s ON s.id = sav.source_supplier_id 
     WHERE s.code = 'sandi' OR LOWER(s.name) LIKE '%sandi%') as sandi_values,
    (SELECT COUNT(*)::integer FROM sku_attribute_values sav 
     JOIN suppliers s ON s.id = sav.source_supplier_id 
     WHERE s.code != 'sandi' AND NOT LOWER(s.name) LIKE '%sandi%') as other_supplier_values,
    (SELECT COUNT(DISTINCT internal_category_id)::integer FROM category_attribute_schemas) as categories_with_schemas;
$$;

COMMENT ON FUNCTION set_active_attribute_value(uuid, uuid, uuid) IS 
  'Switch which attribute value is active for a given SKU and attribute';

COMMENT ON FUNCTION set_manual_override(uuid, uuid, text, uuid) IS 
  'Set a manual override value for an attribute (highest priority except Sandi)';

COMMENT ON FUNCTION resolve_conflicts_for_sku(uuid) IS 
  'Auto-resolve all attribute conflicts for a SKU using priority rules';

COMMENT ON FUNCTION get_attribute_conflicts(uuid, integer) IS 
  'Get list of SKUs with attribute conflicts';

COMMENT ON FUNCTION resolve_all_conflicts() IS 
  'Bulk resolve all attribute conflicts across all SKUs';

COMMENT ON FUNCTION get_attribute_statistics() IS 
  'Get overall statistics about attribute system';
