/*
  # Migrate Existing Attributes to New Schema

  1. Functions
    - `migrate_supplier_attributes()` - Migrates all attributes from supplier_products.attributes JSONB 
      to the new normalized supplier_attribute_values table
    - Extracts all unique attribute names from all products
    - Creates entries in supplier_attribute_values for each product's attributes

  2. Changes
    - Creates migration function
    - Does NOT automatically run migration (manual trigger required)

  3. Usage
    - Run: SELECT migrate_supplier_attributes();
*/

-- Function to migrate attributes from JSONB to normalized tables
CREATE OR REPLACE FUNCTION migrate_supplier_attributes()
RETURNS TABLE(
  migrated_products integer,
  migrated_attributes integer,
  errors text[]
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_product RECORD;
  v_attr_key TEXT;
  v_attr_value TEXT;
  v_migrated_products INTEGER := 0;
  v_migrated_attributes INTEGER := 0;
  v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Loop through all supplier products that have attributes
  FOR v_product IN 
    SELECT id, supplier_id, attributes
    FROM supplier_products
    WHERE attributes IS NOT NULL 
    AND jsonb_typeof(attributes) = 'object'
    AND jsonb_object_keys(attributes) IS NOT NULL
  LOOP
    BEGIN
      -- Loop through each attribute in the JSONB object
      FOR v_attr_key, v_attr_value IN 
        SELECT key, value::text 
        FROM jsonb_each_text(v_product.attributes)
      LOOP
        -- Clean up the value (remove quotes if it's a string)
        v_attr_value := trim(both '"' from v_attr_value);
        
        -- Insert into supplier_attribute_values
        INSERT INTO supplier_attribute_values (
          supplier_product_id,
          supplier_id,
          original_attribute_name,
          value,
          master_attribute_id
        ) VALUES (
          v_product.id,
          v_product.supplier_id,
          v_attr_key,
          v_attr_value,
          NULL  -- Will be linked later when master attributes are created
        )
        ON CONFLICT DO NOTHING;
        
        v_migrated_attributes := v_migrated_attributes + 1;
      END LOOP;
      
      v_migrated_products := v_migrated_products + 1;
      
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, 
        format('Error migrating product %s: %s', v_product.id, SQLERRM)
      );
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_migrated_products, v_migrated_attributes, v_errors;
END;
$$;

-- Function to get all unique attribute names across all products
CREATE OR REPLACE FUNCTION get_all_attribute_names()
RETURNS TABLE(
  attribute_name text,
  usage_count bigint,
  sample_values text[]
)
LANGUAGE sql
AS $$
  SELECT 
    key as attribute_name,
    COUNT(*) as usage_count,
    ARRAY_AGG(DISTINCT value::text ORDER BY value::text) FILTER (WHERE value::text IS NOT NULL) as sample_values
  FROM supplier_products,
    LATERAL jsonb_each(attributes)
  WHERE attributes IS NOT NULL
  GROUP BY key
  ORDER BY usage_count DESC, key;
$$;

COMMENT ON FUNCTION migrate_supplier_attributes() IS 
  'Migrates attributes from supplier_products.attributes JSONB to supplier_attribute_values table';

COMMENT ON FUNCTION get_all_attribute_names() IS 
  'Returns all unique attribute names with usage statistics';
