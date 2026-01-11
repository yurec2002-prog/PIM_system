/*
  # Migrate Existing Products to Multi-Supplier Architecture (v2)

  ## Strategy
  1. Migrate all existing products to supplier_products (linked to Sandi supplier)
  2. Create corresponding internal_skus (1:1 initially)
  3. Create sku_links to connect them
  4. Migrate warehouse_stocks to reference supplier_products
  5. Migrate product_prices to reference supplier_products
*/

-- Get Sandi supplier ID
DO $$
DECLARE
  v_sandi_id uuid;
  v_product_count integer;
BEGIN
  SELECT id INTO v_sandi_id FROM suppliers WHERE code = 'sandi';

  -- ==========================================
  -- 1. MIGRATE PRODUCTS TO SUPPLIER_PRODUCTS
  -- ==========================================
  
  INSERT INTO supplier_products (
    supplier_id,
    supplier_sku,
    supplier_category_id,
    name_ru,
    name_uk,
    description_ru,
    description_uk,
    internal_category_id,
    brand_ref,
    attributes,
    barcode,
    vendor_code,
    images,
    total_stock,
    raw_data,
    created_at,
    updated_at
  )
  SELECT
    v_sandi_id,
    p.supplier_sku,
    p.supplier_category_id,
    p.name_ru,
    p.name_uk,
    p.description_ru,
    p.description_uk,
    p.internal_category_id,
    p.brand_ref,
    COALESCE(p.attributes_ru, '{}'::jsonb),
    p.barcode,
    p.vendor_code,
    COALESCE(p.images, '[]'::jsonb),
    COALESCE(p.total_stock, 0),
    jsonb_build_object(
      'legacy_product_id', p.id,
      'attributes_ru', p.attributes_ru,
      'attributes_uk', p.attributes_uk,
      'main_image', p.main_image
    ),
    p.created_at,
    p.updated_at
  FROM products p
  WHERE NOT EXISTS (
    SELECT 1 FROM supplier_products sp 
    WHERE sp.supplier_id = v_sandi_id 
    AND sp.supplier_sku = p.supplier_sku
  );

  GET DIAGNOSTICS v_product_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % products to supplier_products', v_product_count;

  -- ==========================================
  -- 2. CREATE INTERNAL SKUS FROM PRODUCTS
  -- ==========================================
  
  INSERT INTO internal_skus (
    internal_sku,
    name_ru,
    name_uk,
    description_ru,
    description_uk,
    internal_category_id,
    brand_ref,
    attributes,
    barcode,
    vendor_code,
    images,
    total_stock,
    preferred_supplier_id,
    is_ready,
    blocking_reasons,
    blocking_reasons_text,
    warnings,
    warnings_text,
    quality_score,
    created_at,
    updated_at
  )
  SELECT
    COALESCE(p.internal_sku, 'VOD' || LPAD(p.id::text, 8, '0')), -- Use existing or generate
    p.name_ru,
    p.name_uk,
    p.description_ru,
    p.description_uk,
    p.internal_category_id,
    p.brand_ref,
    COALESCE(p.attributes_ru, '{}'::jsonb),
    p.barcode,
    p.vendor_code,
    COALESCE(p.images, '[]'::jsonb),
    COALESCE(p.total_stock, 0),
    v_sandi_id, -- Sandi is preferred supplier
    COALESCE(p.is_ready, false),
    -- Convert jsonb array to text array for blocking_reasons
    CASE 
      WHEN p.blocking_reasons IS NOT NULL AND jsonb_typeof(p.blocking_reasons) = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(p.blocking_reasons))
      ELSE '{}'::text[]
    END,
    COALESCE(p.blocking_reasons_text, '{"ru": [], "uk": []}'::jsonb),
    -- Convert jsonb array to text array for warnings
    CASE 
      WHEN p.warnings IS NOT NULL AND jsonb_typeof(p.warnings) = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(p.warnings))
      ELSE '{}'::text[]
    END,
    COALESCE(p.warnings_text, '{"ru": [], "uk": []}'::jsonb),
    COALESCE(p.completeness_score, 0),
    p.created_at,
    p.updated_at
  FROM products p
  WHERE NOT EXISTS (
    SELECT 1 FROM internal_skus isk
    WHERE isk.internal_sku = COALESCE(p.internal_sku, 'VOD' || LPAD(p.id::text, 8, '0'))
  );

  GET DIAGNOSTICS v_product_count = ROW_COUNT;
  RAISE NOTICE 'Created % internal SKUs', v_product_count;

  -- ==========================================
  -- 3. CREATE SKU LINKS
  -- ==========================================
  
  INSERT INTO sku_links (
    internal_sku_id,
    supplier_product_id,
    link_type,
    link_confidence,
    is_primary,
    created_at
  )
  SELECT
    isk.id,
    sp.id,
    'manual', -- Initial migration is manual
    1.0, -- 100% confidence
    true, -- Primary link
    now()
  FROM products p
  JOIN internal_skus isk ON isk.internal_sku = COALESCE(p.internal_sku, 'VOD' || LPAD(p.id::text, 8, '0'))
  JOIN supplier_products sp ON sp.supplier_id = v_sandi_id AND sp.supplier_sku = p.supplier_sku
  WHERE NOT EXISTS (
    SELECT 1 FROM sku_links sl
    WHERE sl.internal_sku_id = isk.id
    AND sl.supplier_product_id = sp.id
  );

  GET DIAGNOSTICS v_product_count = ROW_COUNT;
  RAISE NOTICE 'Created % SKU links', v_product_count;

  -- ==========================================
  -- 4. MIGRATE WAREHOUSE STOCKS
  -- ==========================================
  
  UPDATE warehouse_stocks ws
  SET supplier_product_id = sp.id
  FROM products p
  JOIN supplier_products sp ON sp.supplier_id = v_sandi_id AND sp.supplier_sku = p.supplier_sku
  WHERE ws.product_id = p.id
  AND ws.supplier_product_id IS NULL;

  GET DIAGNOSTICS v_product_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % warehouse stock records', v_product_count;

  -- ==========================================
  -- 5. MIGRATE PRODUCT PRICES
  -- ==========================================
  
  UPDATE product_prices pp
  SET supplier_product_id = sp.id
  FROM products p
  JOIN supplier_products sp ON sp.supplier_id = v_sandi_id AND sp.supplier_sku = p.supplier_sku
  WHERE pp.product_id = p.id
  AND pp.supplier_product_id IS NULL;

  GET DIAGNOSTICS v_product_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % price records', v_product_count;

END $$;
