/*
  # Fix cleanup_sandi_data function

  ## Purpose
  Исправляет функцию очистки - использует правильные имена таблиц

  ## Changes
  - Использует product_prices вместо variant_prices
  - Использует warehouse_stocks вместо stock
  - Правильный порядок удаления с учетом FK
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
  
  RAISE NOTICE 'Starting cleanup for supplier %', v_sandi_supplier_id;
  
  -- Delete product_prices for Sandi products
  WITH deleted AS (
    DELETE FROM product_prices pp
    USING products p
    WHERE pp.product_id = p.id 
      AND p.supplier = 'sandi'
    RETURNING pp.id
  )
  SELECT COUNT(*) INTO v_prices_deleted FROM deleted;
  
  RAISE NOTICE 'Deleted % prices', v_prices_deleted;
  
  -- Delete warehouse_stocks for Sandi products
  WITH deleted AS (
    DELETE FROM warehouse_stocks ws
    USING products p
    WHERE ws.product_id = p.id 
      AND p.supplier = 'sandi'
    RETURNING ws.id
  )
  SELECT COUNT(*) INTO v_stocks_deleted FROM deleted;
  
  RAISE NOTICE 'Deleted % stock records', v_stocks_deleted;
  
  -- Delete product_quality_scores
  WITH deleted AS (
    DELETE FROM product_quality_scores pqs
    USING products p
    WHERE pqs.product_id = p.id 
      AND p.supplier = 'sandi'
    RETURNING pqs.id
  )
  SELECT COUNT(*) INTO v_attributes_deleted FROM deleted;
  
  RAISE NOTICE 'Deleted % quality scores', v_attributes_deleted;
  
  -- Delete quality_change_logs
  DELETE FROM quality_change_logs qcl
  USING products p
  WHERE qcl.product_id = p.id 
    AND p.supplier = 'sandi';
  
  -- Delete products
  WITH deleted AS (
    DELETE FROM products
    WHERE supplier = 'sandi'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_products_deleted FROM deleted;
  
  RAISE NOTICE 'Deleted % products', v_products_deleted;
  
  -- Delete supplier_attribute_values
  DELETE FROM supplier_attribute_values sav
  WHERE sav.supplier_id = v_sandi_supplier_id;
  
  -- Delete sku_links
  DELETE FROM sku_links sl
  USING supplier_products sp
  WHERE sl.supplier_product_id = sp.id
    AND sp.supplier_id = v_sandi_supplier_id;
  
  -- Delete internal_skus that have no more links
  DELETE FROM internal_skus isk
  WHERE NOT EXISTS (
    SELECT 1 FROM sku_links sl WHERE sl.internal_sku_id = isk.id
  );
  
  -- Delete supplier_products
  WITH deleted AS (
    DELETE FROM supplier_products
    WHERE supplier_id = v_sandi_supplier_id
    RETURNING id
  )
  SELECT COUNT(*) INTO v_supplier_products_deleted FROM deleted;
  
  RAISE NOTICE 'Deleted % supplier_products', v_supplier_products_deleted;
  
  -- Delete category_mappings
  DELETE FROM category_mappings cm
  USING supplier_categories sc
  WHERE cm.supplier_category_id = sc.id
    AND sc.supplier_id = v_sandi_supplier_id;
  
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
  
  -- Delete brands
  DELETE FROM brands
  WHERE supplier_id = v_sandi_supplier_id;
  
  -- Delete warehouses
  DELETE FROM warehouses
  WHERE supplier_id = v_sandi_supplier_id;
  
  -- Delete import logs
  DELETE FROM import_logs il
  USING imports i
  WHERE il.import_id = i.id
    AND i.supplier_id = v_sandi_supplier_id;
  
  DELETE FROM imports
  WHERE supplier_id = v_sandi_supplier_id;
  
  RAISE NOTICE 'Cleanup completed successfully';
  
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
