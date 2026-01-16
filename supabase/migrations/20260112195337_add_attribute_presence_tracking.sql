/*
  # Add Attribute Presence Tracking System

  1. New Tables
    - `supplier_category_attribute_presence`
      - Tracks which attributes appear in which supplier categories
      - Includes frequency counts and example values
      - Links to mapped master attributes
      - Auto-populated from product imports

  2. Changes
    - Add functions to rebuild attribute presence from existing products
    - Add functions to get category attribute stats
    
  3. Security
    - Enable RLS on new table
    - Add policies for authenticated users
*/

-- Create supplier_category_attribute_presence table
CREATE TABLE IF NOT EXISTS supplier_category_attribute_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_category_id uuid NOT NULL REFERENCES supplier_categories(id) ON DELETE CASCADE,
  attribute_name text NOT NULL,
  frequency_count integer DEFAULT 0,
  example_values jsonb DEFAULT '[]'::jsonb,
  mapped_master_attribute_id uuid REFERENCES master_attributes(id) ON DELETE SET NULL,
  last_seen_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(supplier_category_id, attribute_name)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_scap_supplier_category ON supplier_category_attribute_presence(supplier_category_id);
CREATE INDEX IF NOT EXISTS idx_scap_supplier ON supplier_category_attribute_presence(supplier_id);
CREATE INDEX IF NOT EXISTS idx_scap_mapped_attr ON supplier_category_attribute_presence(mapped_master_attribute_id);
CREATE INDEX IF NOT EXISTS idx_scap_frequency ON supplier_category_attribute_presence(frequency_count DESC);

-- Enable RLS
ALTER TABLE supplier_category_attribute_presence ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read attribute presence"
  ON supplier_category_attribute_presence FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert attribute presence"
  ON supplier_category_attribute_presence FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update attribute presence"
  ON supplier_category_attribute_presence FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete attribute presence"
  ON supplier_category_attribute_presence FOR DELETE
  TO authenticated
  USING (true);

-- Function to rebuild attribute presence from products
CREATE OR REPLACE FUNCTION rebuild_attribute_presence_from_products(
  p_supplier_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_products integer := 0;
  v_total_attributes integer := 0;
  v_categories_processed integer := 0;
BEGIN
  -- Clear existing data for supplier if specified
  IF p_supplier_id IS NOT NULL THEN
    DELETE FROM supplier_category_attribute_presence 
    WHERE supplier_id = p_supplier_id;
  ELSE
    TRUNCATE supplier_category_attribute_presence;
  END IF;

  -- Rebuild from supplier_products
  WITH attribute_stats AS (
    SELECT 
      sp.supplier_id,
      sp.supplier_category_id,
      attr.key as attribute_name,
      COUNT(*) as frequency_count,
      jsonb_agg(DISTINCT attr.value) FILTER (WHERE attr.value IS NOT NULL) as example_values
    FROM supplier_products sp
    CROSS JOIN LATERAL jsonb_each(sp.attributes) AS attr(key, value)
    WHERE (p_supplier_id IS NULL OR sp.supplier_id = p_supplier_id)
      AND sp.supplier_category_id IS NOT NULL
      AND sp.attributes IS NOT NULL
    GROUP BY sp.supplier_id, sp.supplier_category_id, attr.key
  )
  INSERT INTO supplier_category_attribute_presence (
    supplier_id,
    supplier_category_id,
    attribute_name,
    frequency_count,
    example_values,
    last_seen_at
  )
  SELECT 
    supplier_id,
    supplier_category_id,
    attribute_name,
    frequency_count,
    COALESCE(
      (SELECT jsonb_agg(val) FROM (
        SELECT jsonb_array_elements_text(example_values) as val LIMIT 3
      ) sub),
      '[]'::jsonb
    ) as example_values,
    now()
  FROM attribute_stats;

  -- Update mapped_master_attribute_id based on synonyms
  UPDATE supplier_category_attribute_presence scap
  SET mapped_master_attribute_id = ma.id
  FROM category_mappings cm
  JOIN master_attributes ma ON ma.internal_category_id = cm.internal_category_id
  WHERE scap.supplier_category_id = cm.supplier_category_id
    AND (
      ma.name = scap.attribute_name 
      OR scap.attribute_name = ANY(ma.synonyms)
    )
    AND (p_supplier_id IS NULL OR scap.supplier_id = p_supplier_id);

  -- Get stats
  SELECT COUNT(*) INTO v_total_products
  FROM supplier_products
  WHERE p_supplier_id IS NULL OR supplier_id = p_supplier_id;

  SELECT COUNT(*) INTO v_total_attributes
  FROM supplier_category_attribute_presence
  WHERE p_supplier_id IS NULL OR supplier_id = p_supplier_id;

  SELECT COUNT(DISTINCT supplier_category_id) INTO v_categories_processed
  FROM supplier_category_attribute_presence
  WHERE p_supplier_id IS NULL OR supplier_id = p_supplier_id;

  RETURN jsonb_build_object(
    'success', true,
    'products_processed', v_total_products,
    'attributes_discovered', v_total_attributes,
    'categories_processed', v_categories_processed
  );
END;
$$;

-- Function to get category attribute stats
CREATE OR REPLACE FUNCTION get_category_attribute_stats(
  p_category_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_count', COUNT(*),
    'mapped_count', COUNT(*) FILTER (WHERE mapped_master_attribute_id IS NOT NULL),
    'unmapped_count', COUNT(*) FILTER (WHERE mapped_master_attribute_id IS NULL),
    'total_frequency', COALESCE(SUM(frequency_count), 0)
  )
  INTO v_result
  FROM supplier_category_attribute_presence
  WHERE supplier_category_id = p_category_id;

  RETURN v_result;
END;
$$;

-- Function to update attribute presence on product insert/update
CREATE OR REPLACE FUNCTION update_attribute_presence_on_product_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- On INSERT or UPDATE, upsert attribute presence
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.attributes IS NOT NULL AND NEW.supplier_category_id IS NOT NULL THEN
    -- Insert or update each attribute
    INSERT INTO supplier_category_attribute_presence (
      supplier_id,
      supplier_category_id,
      attribute_name,
      frequency_count,
      example_values,
      last_seen_at
    )
    SELECT 
      NEW.supplier_id,
      NEW.supplier_category_id,
      attr.key,
      1,
      jsonb_build_array(attr.value),
      now()
    FROM jsonb_each(NEW.attributes) AS attr(key, value)
    ON CONFLICT (supplier_category_id, attribute_name) 
    DO UPDATE SET
      frequency_count = supplier_category_attribute_presence.frequency_count + 1,
      example_values = (
        SELECT jsonb_agg(DISTINCT val)
        FROM (
          SELECT jsonb_array_elements_text(supplier_category_attribute_presence.example_values) as val
          UNION
          SELECT EXCLUDED.example_values->>0 as val
        ) sub
        LIMIT 3
      ),
      last_seen_at = now(),
      updated_at = now();
  END IF;

  -- On DELETE, decrement frequency
  IF TG_OP = 'DELETE' AND OLD.attributes IS NOT NULL AND OLD.supplier_category_id IS NOT NULL THEN
    UPDATE supplier_category_attribute_presence
    SET 
      frequency_count = GREATEST(frequency_count - 1, 0),
      updated_at = now()
    WHERE supplier_category_id = OLD.supplier_category_id
      AND attribute_name IN (SELECT jsonb_object_keys(OLD.attributes));
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for automatic attribute presence tracking
DROP TRIGGER IF EXISTS trg_update_attribute_presence ON supplier_products;
CREATE TRIGGER trg_update_attribute_presence
  AFTER INSERT OR UPDATE OR DELETE ON supplier_products
  FOR EACH ROW
  EXECUTE FUNCTION update_attribute_presence_on_product_change();
