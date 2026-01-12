/*
  # Create Functions for Sandi Master Attribute Extraction (Fixed)

  1. Functions
    - `extract_sandi_master_attributes()` - Auto-extracts all unique Sandi attributes
    - `create_category_schemas_from_usage()` - Auto-creates category schemas
    - `migrate_to_sku_attribute_values()` - Migrates existing data
    - `get_sku_attributes_with_sources()` - Gets SKU attributes with sources
*/

-- =====================================================
-- 1) Extract Sandi Master Attributes
-- =====================================================
CREATE OR REPLACE FUNCTION extract_sandi_master_attributes()
RETURNS TABLE(
  created_count integer,
  updated_count integer,
  errors text[]
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_attr_name TEXT;
  v_usage_count BIGINT;
  v_detected_type TEXT;
  v_detected_unit TEXT;
  v_priority INTEGER;
  v_created INTEGER := 0;
  v_updated INTEGER := 0;
  v_errors TEXT[] := ARRAY[]::TEXT[];
  v_sandi_supplier_id UUID;
  v_exists BOOLEAN;
BEGIN
  -- Get Sandi supplier ID
  SELECT id INTO v_sandi_supplier_id
  FROM suppliers
  WHERE code = 'sandi' OR LOWER(name) LIKE '%sandi%'
  LIMIT 1;
  
  IF v_sandi_supplier_id IS NULL THEN
    v_errors := array_append(v_errors, 'Sandi supplier not found');
    RETURN QUERY SELECT v_created, v_updated, v_errors;
    RETURN;
  END IF;
  
  -- Loop through all unique Sandi attributes
  FOR v_attr_name, v_usage_count IN
    SELECT 
      sav.original_attribute_name,
      COUNT(*) as usage_count
    FROM supplier_attribute_values sav
    WHERE sav.supplier_id = v_sandi_supplier_id
    GROUP BY sav.original_attribute_name
    ORDER BY usage_count DESC
  LOOP
    BEGIN
      -- Detect type from attribute name
      v_detected_type := CASE
        WHEN v_attr_name ~* 'вес|weight|масса|mass' THEN 'number'
        WHEN v_attr_name ~* 'давление|pressure|температура|temperature|размер|size' THEN 'number'
        WHEN v_attr_name ~* 'наличие|есть|нет|да|имеется' THEN 'boolean'
        ELSE 'text'
      END;
      
      -- Detect unit
      v_detected_unit := CASE
        WHEN v_attr_name ~* 'кг|kg' THEN 'кг'
        WHEN v_attr_name ~* 'мм|mm' THEN 'мм'
        WHEN v_attr_name ~* 'бар|bar' THEN 'бар'
        WHEN v_attr_name ~* '°c|°с|градус' THEN '°С'
        WHEN v_attr_name ~* 'метр|meter|м[^м]' THEN 'м'
        ELSE NULL
      END;
      
      -- Calculate priority
      v_priority := CASE
        WHEN v_usage_count > 200 THEN 100
        WHEN v_usage_count > 150 THEN 90
        WHEN v_usage_count > 100 THEN 80
        WHEN v_usage_count > 50 THEN 70
        ELSE 50
      END;
      
      -- Check if exists
      SELECT EXISTS(
        SELECT 1 FROM master_attribute_dictionary 
        WHERE sandi_attr_key = v_attr_name
      ) INTO v_exists;
      
      -- Insert or update
      IF NOT v_exists THEN
        INSERT INTO master_attribute_dictionary (
          sandi_attr_key,
          name_ru,
          name_uk,
          type,
          unit,
          priority,
          is_filterable,
          is_comparable,
          synonyms
        ) VALUES (
          v_attr_name,
          v_attr_name,
          NULL,
          v_detected_type,
          v_detected_unit,
          v_priority,
          v_detected_type IN ('number', 'select', 'boolean'),
          v_detected_type = 'number',
          ARRAY[v_attr_name, LOWER(v_attr_name)]
        );
        v_created := v_created + 1;
      ELSE
        UPDATE master_attribute_dictionary
        SET 
          priority = v_priority,
          updated_at = now()
        WHERE sandi_attr_key = v_attr_name;
        v_updated := v_updated + 1;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 
        format('Error processing attribute %s: %s', v_attr_name, SQLERRM)
      );
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_created, v_updated, v_errors;
END;
$$;

-- =====================================================
-- 2) Create Category Schemas from Usage
-- =====================================================
CREATE OR REPLACE FUNCTION create_category_schemas_from_usage()
RETURNS TABLE(
  schemas_created integer,
  errors text[]
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_created INTEGER := 0;
  v_errors TEXT[] := ARRAY[]::TEXT[];
  v_sandi_supplier_id UUID;
BEGIN
  -- Get Sandi supplier ID
  SELECT id INTO v_sandi_supplier_id
  FROM suppliers
  WHERE code = 'sandi' OR LOWER(name) LIKE '%sandi%'
  LIMIT 1;
  
  -- Create category schemas based on actual attribute usage
  INSERT INTO category_attribute_schemas (
    internal_category_id,
    master_attr_id,
    is_required,
    priority_override,
    attribute_group
  )
  SELECT 
    isk.internal_category_id,
    mad.id as master_attr_id,
    COUNT(*) > (COUNT(DISTINCT isk.id) * 0.8) as is_required,
    mad.priority as priority_override,
    CASE
      WHEN mad.sandi_attr_key IN ('Артикул', 'Серия', 'Тип изделия') THEN 'main'
      WHEN mad.type = 'number' THEN 'technical'
      ELSE 'additional'
    END as attribute_group
  FROM supplier_attribute_values sav
  JOIN master_attribute_dictionary mad ON mad.sandi_attr_key = sav.original_attribute_name
  JOIN supplier_products sp ON sp.id = sav.supplier_product_id
  JOIN sku_links sl ON sl.supplier_product_id = sp.id
  JOIN internal_skus isk ON isk.id = sl.internal_sku_id
  WHERE sav.supplier_id = v_sandi_supplier_id
    AND isk.internal_category_id IS NOT NULL
  GROUP BY isk.internal_category_id, mad.id, mad.sandi_attr_key, mad.priority, mad.type
  HAVING COUNT(*) > 0
  ON CONFLICT (internal_category_id, master_attr_id) DO NOTHING;
  
  GET DIAGNOSTICS v_created = ROW_COUNT;
  
  RETURN QUERY SELECT v_created, v_errors;
END;
$$;

-- =====================================================
-- 3) Migrate to SKU Attribute Values
-- =====================================================
CREATE OR REPLACE FUNCTION migrate_to_sku_attribute_values()
RETURNS TABLE(
  migrated_count integer,
  conflicts_detected integer,
  errors text[]
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_migrated INTEGER := 0;
  v_conflicts INTEGER := 0;
  v_errors TEXT[] := ARRAY[]::TEXT[];
  v_sandi_supplier_id UUID;
BEGIN
  -- Get Sandi supplier ID
  SELECT id INTO v_sandi_supplier_id
  FROM suppliers
  WHERE code = 'sandi' OR LOWER(name) LIKE '%sandi%'
  LIMIT 1;
  
  -- Migrate supplier attribute values to SKU attribute values
  INSERT INTO sku_attribute_values (
    internal_sku_id,
    master_attr_id,
    value,
    value_normalized,
    source_supplier_id,
    source_type,
    is_active,
    priority_score
  )
  SELECT 
    isk.id as internal_sku_id,
    mad.id as master_attr_id,
    sav.value,
    sav.value as value_normalized,
    sav.supplier_id,
    'auto' as source_type,
    true as is_active,
    CASE WHEN sav.supplier_id = v_sandi_supplier_id THEN 100 ELSE 50 END as priority_score
  FROM supplier_attribute_values sav
  JOIN master_attribute_dictionary mad ON mad.sandi_attr_key = sav.original_attribute_name
  JOIN supplier_products sp ON sp.id = sav.supplier_product_id
  JOIN sku_links sl ON sl.supplier_product_id = sp.id
  JOIN internal_skus isk ON isk.id = sl.internal_sku_id
  WHERE sav.value IS NOT NULL
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS v_migrated = ROW_COUNT;
  
  -- Mark only highest priority value as active
  UPDATE sku_attribute_values sav1
  SET is_active = false
  WHERE EXISTS (
    SELECT 1
    FROM sku_attribute_values sav2
    WHERE sav2.internal_sku_id = sav1.internal_sku_id
      AND sav2.master_attr_id = sav1.master_attr_id
      AND sav2.priority_score > sav1.priority_score
      AND sav2.is_active = true
  );
  
  -- Detect conflicts
  UPDATE sku_attribute_values sav1
  SET 
    has_conflict = true,
    conflict_count = (
      SELECT COUNT(DISTINCT value) - 1
      FROM sku_attribute_values sav2
      WHERE sav2.internal_sku_id = sav1.internal_sku_id
        AND sav2.master_attr_id = sav1.master_attr_id
        AND sav2.value IS NOT NULL
    )
  WHERE EXISTS (
    SELECT 1
    FROM sku_attribute_values sav2
    WHERE sav2.internal_sku_id = sav1.internal_sku_id
      AND sav2.master_attr_id = sav1.master_attr_id
      AND sav2.value != sav1.value
      AND sav2.value IS NOT NULL
  );
  
  SELECT COUNT(*) INTO v_conflicts
  FROM sku_attribute_values
  WHERE has_conflict = true;
  
  RETURN QUERY SELECT v_migrated, v_conflicts, v_errors;
END;
$$;

-- =====================================================
-- 4) Get SKU Attributes with Sources
-- =====================================================
CREATE OR REPLACE FUNCTION get_sku_attributes_with_sources(p_internal_sku_id uuid)
RETURNS TABLE(
  master_attr_id uuid,
  attr_name_ru text,
  attr_type text,
  attr_unit text,
  is_required boolean,
  active_value text,
  active_source_supplier_id uuid,
  active_source_supplier_name text,
  is_manual_override boolean,
  has_conflict boolean,
  conflict_count integer,
  all_values jsonb
)
LANGUAGE sql
AS $$
  SELECT 
    mad.id as master_attr_id,
    mad.name_ru as attr_name_ru,
    mad.type as attr_type,
    mad.unit as attr_unit,
    COALESCE(cas.is_required, false) as is_required,
    
    active_val.value as active_value,
    active_val.source_supplier_id as active_source_supplier_id,
    active_supplier.name as active_source_supplier_name,
    active_val.is_manual_override,
    active_val.has_conflict,
    active_val.conflict_count,
    
    (SELECT jsonb_agg(
       jsonb_build_object(
         'value', sav.value,
         'supplier_id', sav.source_supplier_id,
         'supplier_name', s.name,
         'is_active', sav.is_active,
         'priority_score', sav.priority_score
       ) ORDER BY sav.priority_score DESC
     )
     FROM sku_attribute_values sav
     JOIN suppliers s ON s.id = sav.source_supplier_id
     WHERE sav.internal_sku_id = p_internal_sku_id 
       AND sav.master_attr_id = mad.id
    ) as all_values
    
  FROM master_attribute_dictionary mad
  JOIN sku_attribute_values active_val ON active_val.master_attr_id = mad.id 
    AND active_val.internal_sku_id = p_internal_sku_id
    AND active_val.is_active = true
  JOIN suppliers active_supplier ON active_supplier.id = active_val.source_supplier_id
  LEFT JOIN (
    SELECT cas.master_attr_id, cas.is_required, cas.priority_override
    FROM category_attribute_schemas cas
    JOIN internal_skus isk ON isk.internal_category_id = cas.internal_category_id
    WHERE isk.id = p_internal_sku_id
  ) cas ON cas.master_attr_id = mad.id
  ORDER BY COALESCE(cas.priority_override, mad.priority) DESC, mad.name_ru;
$$;
