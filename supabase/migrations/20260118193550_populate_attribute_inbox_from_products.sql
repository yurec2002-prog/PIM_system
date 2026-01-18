/*
  # Populate attribute_inbox from existing products

  ## Purpose
  Извлекает все уникальные атрибуты из products и заполняет attribute_inbox
  с правильными name_uk и name_ru из ключей attributes_uk и attributes_ru

  ## Changes
  - Функция populate_attribute_inbox_from_products() - сканирует products
  - Извлекает уникальные пары (raw_name, name_uk, name_ru) из атрибутов
  - Добавляет в attribute_inbox с примерами значений
  - Вычисляет frequency для каждого атрибута
*/

CREATE OR REPLACE FUNCTION populate_attribute_inbox_from_products()
RETURNS TABLE(
  attributes_processed integer,
  inbox_items_created integer,
  inbox_items_updated integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_processed integer := 0;
  v_created integer := 0;
  v_updated integer := 0;
  v_product RECORD;
  v_attr_key_ru text;
  v_attr_key_uk text;
  v_attr_value_ru text;
  v_attr_value_uk text;
  v_existing_id uuid;
  v_frequency integer;
  v_examples text[];
BEGIN
  -- Loop through all products
  FOR v_product IN
    SELECT 
      p.id,
      p.supplier,
      p.supplier_category_id,
      p.attributes_ru,
      p.attributes_uk,
      s.id as supplier_id
    FROM products p
    JOIN suppliers s ON s.code = p.supplier
    WHERE p.attributes_ru IS NOT NULL 
       OR p.attributes_uk IS NOT NULL
  LOOP
    -- Process RU attributes
    IF v_product.attributes_ru IS NOT NULL THEN
      FOR v_attr_key_ru IN
        SELECT jsonb_object_keys(v_product.attributes_ru)
      LOOP
        v_attr_value_ru := v_product.attributes_ru->>v_attr_key_ru;
        
        -- Try to find corresponding UK key
        v_attr_key_uk := NULL;
        IF v_product.attributes_uk IS NOT NULL THEN
          -- Find UK key at same position or by matching value pattern
          v_attr_key_uk := (
            SELECT jsonb_object_keys(v_product.attributes_uk)
            LIMIT 1 OFFSET (
              SELECT ordinality - 1
              FROM jsonb_object_keys(v_product.attributes_ru) WITH ORDINALITY
              WHERE jsonb_object_keys = v_attr_key_ru
            )
          );
        END IF;
        
        -- Get UK value
        IF v_attr_key_uk IS NOT NULL AND v_product.attributes_uk IS NOT NULL THEN
          v_attr_value_uk := v_product.attributes_uk->>v_attr_key_uk;
        ELSE
          v_attr_key_uk := v_attr_key_ru;
          v_attr_value_uk := v_attr_value_ru;
        END IF;
        
        -- Check if inbox item exists
        SELECT id INTO v_existing_id
        FROM attribute_inbox
        WHERE supplier_id = v_product.supplier_id
          AND raw_name = v_attr_key_ru
          AND (supplier_category_id = v_product.supplier_category_id OR (supplier_category_id IS NULL AND v_product.supplier_category_id IS NULL));
        
        IF v_existing_id IS NULL THEN
          -- Calculate frequency and examples
          SELECT 
            COUNT(*) as freq,
            array_agg(DISTINCT val ORDER BY val) as exs
          INTO v_frequency, v_examples
          FROM (
            SELECT p2.attributes_ru->>v_attr_key_ru as val
            FROM products p2
            WHERE p2.supplier = v_product.supplier
              AND p2.attributes_ru ? v_attr_key_ru
              AND p2.attributes_ru->>v_attr_key_ru IS NOT NULL
            LIMIT 5
          ) vals;
          
          -- Create new inbox item
          INSERT INTO attribute_inbox (
            supplier_id,
            supplier_category_id,
            raw_name,
            name_ru,
            name_uk,
            frequency,
            examples,
            status
          ) VALUES (
            v_product.supplier_id,
            v_product.supplier_category_id,
            v_attr_key_ru,
            v_attr_key_ru,
            v_attr_key_uk,
            v_frequency,
            v_examples,
            'new'
          );
          
          v_created := v_created + 1;
        ELSE
          -- Update frequency and examples
          SELECT 
            COUNT(*) as freq,
            array_agg(DISTINCT val ORDER BY val) as exs
          INTO v_frequency, v_examples
          FROM (
            SELECT p2.attributes_ru->>v_attr_key_ru as val
            FROM products p2
            WHERE p2.supplier = v_product.supplier
              AND p2.attributes_ru ? v_attr_key_ru
              AND p2.attributes_ru->>v_attr_key_ru IS NOT NULL
            LIMIT 5
          ) vals;
          
          UPDATE attribute_inbox
          SET 
            name_uk = v_attr_key_uk,
            frequency = v_frequency,
            examples = v_examples,
            updated_at = now()
          WHERE id = v_existing_id;
          
          v_updated := v_updated + 1;
        END IF;
        
        v_processed := v_processed + 1;
      END LOOP;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT v_processed, v_created, v_updated;
END;
$$;

COMMENT ON FUNCTION populate_attribute_inbox_from_products() IS 
  'Извлекает атрибуты из products и заполняет attribute_inbox с правильными name_uk и name_ru';
