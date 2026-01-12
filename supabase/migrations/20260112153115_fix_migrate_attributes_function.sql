/*
  # Fix Attribute Migration Function

  1. Changes
    - Fixed the WHERE clause to avoid set-returning function error
    - Improved query logic
*/

-- Fixed migration function
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
    AND attributes != '{}'::jsonb
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
