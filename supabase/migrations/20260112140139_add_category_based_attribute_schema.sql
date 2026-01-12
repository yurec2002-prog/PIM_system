/*
  # Category-Based Attribute Schema System with Conflict Resolution

  ## Overview
  This migration implements a structured attribute management system where attributes
  are defined at the category level and values are stored separately with multi-supplier
  conflict detection and resolution.

  ## New Tables

  ### 1. master_attributes
  Defines attribute schemas assigned to internal (master) categories:
  - `id` (uuid, primary key) - Unique attribute definition ID
  - `internal_category_id` (uuid) - Category this attribute belongs to
  - `name` (text) - Display name of the attribute
  - `type` (text) - Data type: 'text', 'number', 'select', 'boolean'
  - `unit` (text, nullable) - Unit of measurement (e.g., 'cm', 'kg', 'W')
  - `is_required` (boolean) - Whether this attribute is required for the category
  - `select_options` (jsonb, nullable) - Available options for select type
  - `synonyms` (text[]) - List of supplier attribute names that map to this
  - `preferred_source_rule` (text) - How to resolve conflicts: 'manual', 'supplier:{id}', 'newest', 'oldest'
  - `display_order` (integer) - Order for displaying attributes
  - `is_pinned` (boolean) - Whether to show prominently in UI
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. master_attribute_values
  Stores the resolved/selected values for each internal SKU:
  - `id` (uuid, primary key)
  - `internal_sku_id` (uuid) - The internal SKU this value belongs to
  - `master_attribute_id` (uuid) - The attribute definition
  - `value` (text) - The selected/resolved value
  - `source_type` (text) - 'manual', 'supplier', 'auto'
  - `source_supplier_id` (uuid, nullable) - Which supplier's value was chosen
  - `has_conflict` (boolean) - Whether multiple suppliers have different values
  - `manual_override` (boolean) - Whether value was manually overridden
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. supplier_attribute_values
  Stores raw attribute values from each supplier:
  - `id` (uuid, primary key)
  - `supplier_product_id` (uuid) - The supplier product this came from
  - `supplier_id` (uuid) - The supplier
  - `original_attribute_name` (text) - Original attribute name from supplier
  - `value` (text) - The value from supplier
  - `master_attribute_id` (uuid, nullable) - Mapped master attribute (if recognized)
  - `import_log_id` (uuid, nullable) - Which import this came from
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Functions

  - `sync_supplier_attributes_to_master()` - Maps supplier attributes to master attributes using synonyms
  - `detect_attribute_conflicts()` - Detects conflicts between supplier values
  - `resolve_attribute_value()` - Resolves conflicts using preferred source rules
  - `update_master_attribute_values()` - Trigger to keep values in sync

  ## Security
  
  All tables have RLS enabled with appropriate policies for authenticated users.
*/

-- ============================================================================
-- TABLE: master_attributes
-- ============================================================================

CREATE TABLE IF NOT EXISTS master_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_category_id uuid NOT NULL REFERENCES internal_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('text', 'number', 'select', 'boolean')),
  unit text,
  is_required boolean DEFAULT false,
  select_options jsonb,
  synonyms text[] DEFAULT '{}',
  preferred_source_rule text DEFAULT 'manual',
  display_order integer DEFAULT 0,
  is_pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(internal_category_id, name)
);

CREATE INDEX IF NOT EXISTS idx_master_attributes_category ON master_attributes(internal_category_id);
CREATE INDEX IF NOT EXISTS idx_master_attributes_synonyms ON master_attributes USING gin(synonyms);

ALTER TABLE master_attributes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view master attributes"
  ON master_attributes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage master attributes"
  ON master_attributes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- TABLE: master_attribute_values
-- ============================================================================

CREATE TABLE IF NOT EXISTS master_attribute_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_sku_id uuid NOT NULL REFERENCES internal_skus(id) ON DELETE CASCADE,
  master_attribute_id uuid NOT NULL REFERENCES master_attributes(id) ON DELETE CASCADE,
  value text,
  source_type text DEFAULT 'auto' CHECK (source_type IN ('manual', 'supplier', 'auto')),
  source_supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  has_conflict boolean DEFAULT false,
  manual_override boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(internal_sku_id, master_attribute_id)
);

CREATE INDEX IF NOT EXISTS idx_master_attribute_values_sku ON master_attribute_values(internal_sku_id);
CREATE INDEX IF NOT EXISTS idx_master_attribute_values_attribute ON master_attribute_values(master_attribute_id);
CREATE INDEX IF NOT EXISTS idx_master_attribute_values_conflict ON master_attribute_values(has_conflict) WHERE has_conflict = true;

ALTER TABLE master_attribute_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view master attribute values"
  ON master_attribute_values FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage master attribute values"
  ON master_attribute_values FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- TABLE: supplier_attribute_values
-- ============================================================================

CREATE TABLE IF NOT EXISTS supplier_attribute_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_product_id uuid NOT NULL REFERENCES supplier_products(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  original_attribute_name text NOT NULL,
  value text,
  master_attribute_id uuid REFERENCES master_attributes(id) ON DELETE SET NULL,
  import_log_id uuid REFERENCES import_logs(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_attribute_values_product ON supplier_attribute_values(supplier_product_id);
CREATE INDEX IF NOT EXISTS idx_supplier_attribute_values_supplier ON supplier_attribute_values(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_attribute_values_master ON supplier_attribute_values(master_attribute_id);
CREATE INDEX IF NOT EXISTS idx_supplier_attribute_values_name ON supplier_attribute_values(original_attribute_name);

ALTER TABLE supplier_attribute_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view supplier attribute values"
  ON supplier_attribute_values FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage supplier attribute values"
  ON supplier_attribute_values FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- FUNCTION: sync_supplier_attributes_to_master
-- Maps supplier attributes to master attributes using synonyms
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_supplier_attributes_to_master()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Map supplier attributes to master attributes based on synonyms
  UPDATE supplier_attribute_values sav
  SET master_attribute_id = ma.id
  FROM master_attributes ma,
       supplier_products sp,
       sku_links sl,
       internal_skus isk
  WHERE sav.supplier_product_id = sp.id
    AND sp.id = sl.supplier_product_id
    AND sl.internal_sku_id = isk.id
    AND isk.internal_category_id = ma.internal_category_id
    AND (
      LOWER(sav.original_attribute_name) = ANY(
        SELECT LOWER(unnest(ma.synonyms))
      )
      OR LOWER(sav.original_attribute_name) = LOWER(ma.name)
    )
    AND sav.master_attribute_id IS NULL;
END;
$$;

-- ============================================================================
-- FUNCTION: detect_attribute_conflicts
-- Detects conflicts when multiple suppliers provide different values
-- ============================================================================

CREATE OR REPLACE FUNCTION detect_attribute_conflicts(p_internal_sku_id uuid)
RETURNS TABLE(
  master_attribute_id uuid,
  attribute_name text,
  values_count bigint,
  supplier_values jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH supplier_vals AS (
    SELECT 
      sav.master_attribute_id,
      ma.name as attribute_name,
      sav.value,
      sav.supplier_id,
      s.name as supplier_name
    FROM supplier_attribute_values sav
    JOIN master_attributes ma ON ma.id = sav.master_attribute_id
    JOIN supplier_products sp ON sp.id = sav.supplier_product_id
    JOIN sku_links sl ON sl.supplier_product_id = sp.id
    JOIN suppliers s ON s.id = sav.supplier_id
    WHERE sl.internal_sku_id = p_internal_sku_id
      AND sav.master_attribute_id IS NOT NULL
      AND sav.value IS NOT NULL
      AND sav.value != ''
  ),
  conflict_check AS (
    SELECT 
      sv.master_attribute_id,
      sv.attribute_name,
      COUNT(DISTINCT sv.value) as values_count,
      jsonb_agg(
        jsonb_build_object(
          'supplier_id', sv.supplier_id,
          'supplier_name', sv.supplier_name,
          'value', sv.value
        ) ORDER BY sv.supplier_name
      ) as supplier_values
    FROM supplier_vals sv
    GROUP BY sv.master_attribute_id, sv.attribute_name
  )
  SELECT 
    cc.master_attribute_id,
    cc.attribute_name,
    cc.values_count,
    cc.supplier_values
  FROM conflict_check cc
  WHERE cc.values_count > 1;
END;
$$;

-- ============================================================================
-- FUNCTION: resolve_attribute_value
-- Resolves attribute value based on preferred source rule
-- ============================================================================

CREATE OR REPLACE FUNCTION resolve_attribute_value(
  p_internal_sku_id uuid,
  p_master_attribute_id uuid
)
RETURNS TABLE(
  resolved_value text,
  source_supplier_id uuid,
  has_conflict boolean
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_preferred_rule text;
  v_preferred_supplier_id uuid;
BEGIN
  -- Get the preferred source rule
  SELECT preferred_source_rule INTO v_preferred_rule
  FROM master_attributes
  WHERE id = p_master_attribute_id;

  -- Extract supplier ID if rule is 'supplier:uuid'
  IF v_preferred_rule LIKE 'supplier:%' THEN
    v_preferred_supplier_id := (regexp_matches(v_preferred_rule, 'supplier:(.+)'))[1]::uuid;
  END IF;

  RETURN QUERY
  WITH supplier_vals AS (
    SELECT 
      sav.value,
      sav.supplier_id,
      sav.created_at,
      COUNT(*) OVER () > 1 as has_conflict_flag
    FROM supplier_attribute_values sav
    JOIN supplier_products sp ON sp.id = sav.supplier_product_id
    JOIN sku_links sl ON sl.supplier_product_id = sp.id
    WHERE sl.internal_sku_id = p_internal_sku_id
      AND sav.master_attribute_id = p_master_attribute_id
      AND sav.value IS NOT NULL
      AND sav.value != ''
  ),
  ranked_vals AS (
    SELECT 
      sv.value,
      sv.supplier_id,
      sv.has_conflict_flag,
      CASE 
        WHEN v_preferred_rule = 'manual' THEN 0
        WHEN v_preferred_rule LIKE 'supplier:%' AND sv.supplier_id = v_preferred_supplier_id THEN 1
        WHEN v_preferred_rule = 'newest' THEN 2
        WHEN v_preferred_rule = 'oldest' THEN 3
        ELSE 0
      END as priority,
      sv.created_at
    FROM supplier_vals sv
  )
  SELECT 
    rv.value,
    rv.supplier_id,
    rv.has_conflict_flag
  FROM ranked_vals rv
  ORDER BY 
    rv.priority DESC,
    CASE WHEN v_preferred_rule = 'newest' THEN rv.created_at END DESC,
    CASE WHEN v_preferred_rule = 'oldest' THEN rv.created_at END ASC
  LIMIT 1;
END;
$$;

-- ============================================================================
-- FUNCTION: update_master_attribute_values_for_sku
-- Updates all master attribute values for a given internal SKU
-- ============================================================================

CREATE OR REPLACE FUNCTION update_master_attribute_values_for_sku(p_internal_sku_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_category_id uuid;
  v_attr record;
  v_resolved record;
BEGIN
  -- Get the category for this SKU
  SELECT internal_category_id INTO v_category_id
  FROM internal_skus
  WHERE id = p_internal_sku_id;

  IF v_category_id IS NULL THEN
    RETURN;
  END IF;

  -- Loop through all master attributes for this category
  FOR v_attr IN 
    SELECT id FROM master_attributes WHERE internal_category_id = v_category_id
  LOOP
    -- Check if there's a manual override
    IF EXISTS (
      SELECT 1 FROM master_attribute_values 
      WHERE internal_sku_id = p_internal_sku_id 
        AND master_attribute_id = v_attr.id 
        AND manual_override = true
    ) THEN
      -- Skip if manual override exists
      CONTINUE;
    END IF;

    -- Resolve the value
    SELECT * INTO v_resolved
    FROM resolve_attribute_value(p_internal_sku_id, v_attr.id);

    IF v_resolved.resolved_value IS NOT NULL THEN
      -- Insert or update the master attribute value
      INSERT INTO master_attribute_values (
        internal_sku_id,
        master_attribute_id,
        value,
        source_type,
        source_supplier_id,
        has_conflict,
        manual_override
      ) VALUES (
        p_internal_sku_id,
        v_attr.id,
        v_resolved.resolved_value,
        'supplier',
        v_resolved.source_supplier_id,
        v_resolved.has_conflict,
        false
      )
      ON CONFLICT (internal_sku_id, master_attribute_id) 
      DO UPDATE SET
        value = EXCLUDED.value,
        source_type = EXCLUDED.source_type,
        source_supplier_id = EXCLUDED.source_supplier_id,
        has_conflict = EXCLUDED.has_conflict,
        updated_at = now()
      WHERE master_attribute_values.manual_override = false;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================================
-- TRIGGER: Update master attribute values when supplier attributes change
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_update_master_attribute_values()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_internal_sku_id uuid;
BEGIN
  -- Get the internal SKU ID from the supplier product
  SELECT sl.internal_sku_id INTO v_internal_sku_id
  FROM sku_links sl
  WHERE sl.supplier_product_id = COALESCE(NEW.supplier_product_id, OLD.supplier_product_id)
  LIMIT 1;

  IF v_internal_sku_id IS NOT NULL THEN
    PERFORM update_master_attribute_values_for_sku(v_internal_sku_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER update_master_attrs_on_supplier_attr_change
AFTER INSERT OR UPDATE OR DELETE ON supplier_attribute_values
FOR EACH ROW
EXECUTE FUNCTION trigger_update_master_attribute_values();

-- ============================================================================
-- HELPER FUNCTION: Get all attribute values with conflicts for a SKU
-- ============================================================================

CREATE OR REPLACE FUNCTION get_sku_attributes_with_conflicts(p_internal_sku_id uuid)
RETURNS TABLE(
  master_attribute_id uuid,
  attribute_name text,
  attribute_type text,
  unit text,
  is_required boolean,
  current_value text,
  source_type text,
  source_supplier_id uuid,
  source_supplier_name text,
  has_conflict boolean,
  manual_override boolean,
  conflict_details jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ma.id as master_attribute_id,
    ma.name as attribute_name,
    ma.type as attribute_type,
    ma.unit,
    ma.is_required,
    mav.value as current_value,
    mav.source_type,
    mav.source_supplier_id,
    s.name as source_supplier_name,
    mav.has_conflict,
    mav.manual_override,
    CASE 
      WHEN mav.has_conflict THEN (
        SELECT jsonb_agg(
          jsonb_build_object(
            'supplier_id', sav.supplier_id,
            'supplier_name', sup.name,
            'value', sav.value
          )
        )
        FROM supplier_attribute_values sav
        JOIN supplier_products sp ON sp.id = sav.supplier_product_id
        JOIN sku_links sl ON sl.supplier_product_id = sp.id
        JOIN suppliers sup ON sup.id = sav.supplier_id
        WHERE sl.internal_sku_id = p_internal_sku_id
          AND sav.master_attribute_id = ma.id
      )
      ELSE NULL
    END as conflict_details
  FROM master_attributes ma
  LEFT JOIN master_attribute_values mav ON mav.master_attribute_id = ma.id 
    AND mav.internal_sku_id = p_internal_sku_id
  LEFT JOIN suppliers s ON s.id = mav.source_supplier_id
  WHERE ma.internal_category_id = (
    SELECT internal_category_id FROM internal_skus WHERE id = p_internal_sku_id
  )
  ORDER BY ma.display_order, ma.name;
END;
$$;
