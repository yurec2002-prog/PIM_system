/*
  # Add function to cleanup all Sandi data

  ## Purpose
  Создает функцию для полной очистки всех данных Sandi перед переимпортом

  ## Changes
  - Функция cleanup_sandi_data() - удаляет все данные Sandi
  - Удаляет products, supplier_products, категории, атрибуты
  - Возвращает статистику удаления
*/

CREATE OR REPLACE FUNCTION cleanup_sandi_data()
RETURNS TABLE(
  products_deleted integer,
  supplier_products_deleted integer,
  categories_deleted integer,
  prices_deleted integer,
  stocks_deleted integer,
  attributes_deleted integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_sandi_supplier_id uuid;
  v_products_deleted integer := 0;
  v_supplier_products_deleted integer := 0;
  v_categories_deleted integer := 0;
  v_prices_deleted integer := 0;
  v_stocks_deleted integer := 0;
  v_attributes_deleted integer := 0;
BEGIN
  -- Get Sandi supplier ID
  SELECT id INTO v_sandi_supplier_id
  FROM suppliers
  WHERE code = 'sandi'
  LIMIT 1;
  
  IF v_sandi_supplier_id IS NULL THEN
    RAISE NOTICE 'Sandi supplier not found';
    RETURN QUERY SELECT 0, 0, 0, 0, 0, 0;
    RETURN;
  END IF;
  
  -- Delete variant_prices for Sandi products
  WITH deleted AS (
    DELETE FROM variant_prices vp
    USING products p
    WHERE vp.product_id = p.id 
      AND p.supplier = 'sandi'
    RETURNING vp.id
  )
  SELECT COUNT(*) INTO v_prices_deleted FROM deleted;
  
  RAISE NOTICE 'Deleted % prices', v_prices_deleted;
  
  -- Delete stock for Sandi products
  WITH deleted AS (
    DELETE FROM stock s
    USING products p
    WHERE s.product_id = p.id 
      AND p.supplier = 'sandi'
    RETURNING s.id
  )
  SELECT COUNT(*) INTO v_stocks_deleted FROM deleted;
  
  RAISE NOTICE 'Deleted % stock records', v_stocks_deleted;
  
  -- Delete products
  WITH deleted AS (
    DELETE FROM products
    WHERE supplier = 'sandi'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_products_deleted FROM deleted;
  
  RAISE NOTICE 'Deleted % products', v_products_deleted;
  
  -- Delete supplier_products
  WITH deleted AS (
    DELETE FROM supplier_products
    WHERE supplier_id = v_sandi_supplier_id
    RETURNING id
  )
  SELECT COUNT(*) INTO v_supplier_products_deleted FROM deleted;
  
  RAISE NOTICE 'Deleted % supplier_products', v_supplier_products_deleted;
  
  -- Delete supplier_categories
  WITH deleted AS (
    DELETE FROM supplier_categories
    WHERE supplier_id = v_sandi_supplier_id
    RETURNING id
  )
  SELECT COUNT(*) INTO v_categories_deleted FROM deleted;
  
  RAISE NOTICE 'Deleted % categories', v_categories_deleted;
  
  -- Delete attribute_inbox for Sandi
  WITH deleted AS (
    DELETE FROM attribute_inbox
    WHERE supplier_id = v_sandi_supplier_id
    RETURNING id
  )
  SELECT COUNT(*) INTO v_attributes_deleted FROM deleted;
  
  RAISE NOTICE 'Deleted % attribute inbox items', v_attributes_deleted;
  
  RETURN QUERY SELECT 
    v_products_deleted,
    v_supplier_products_deleted,
    v_categories_deleted,
    v_prices_deleted,
    v_stocks_deleted,
    v_attributes_deleted;
END;
$$;

COMMENT ON FUNCTION cleanup_sandi_data() IS 
  'Удаляет все данные Sandi для чистого переимпорта';
