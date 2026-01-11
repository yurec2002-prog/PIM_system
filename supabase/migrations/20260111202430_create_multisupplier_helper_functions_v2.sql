/*
  # Multi-Supplier Helper Functions (v2)

  ## Functions Created
  1. aggregate_internal_sku_data() - Aggregate data from linked supplier products
  2. calculate_internal_sku_readiness() - Calculate readiness for internal SKU
  3. update_internal_sku_from_links() - Sync internal SKU data from supplier products
  4. Triggers for auto-aggregation
*/

-- ==========================================
-- 1. AGGREGATE INTERNAL SKU DATA
-- ==========================================

CREATE OR REPLACE FUNCTION aggregate_internal_sku_data(p_internal_sku_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_stock integer;
  v_min_retail numeric;
  v_max_retail numeric;
  v_min_purchase numeric;
BEGIN
  -- Aggregate stock from all linked supplier products
  SELECT 
    COALESCE(SUM(sp.total_stock), 0)
  INTO v_total_stock
  FROM sku_links sl
  JOIN supplier_products sp ON sp.id = sl.supplier_product_id
  WHERE sl.internal_sku_id = p_internal_sku_id;

  -- Aggregate prices from all linked supplier products
  SELECT 
    MIN(CASE WHEN pp.price_type = 'розничная' THEN pp.value END),
    MAX(CASE WHEN pp.price_type = 'розничная' THEN pp.value END),
    MIN(CASE WHEN pp.price_type = 'закупочная' THEN pp.value END)
  INTO v_min_retail, v_max_retail, v_min_purchase
  FROM sku_links sl
  JOIN product_prices pp ON pp.supplier_product_id = sl.supplier_product_id
  WHERE sl.internal_sku_id = p_internal_sku_id;

  -- Update internal SKU
  UPDATE internal_skus
  SET 
    total_stock = v_total_stock,
    min_retail_price = v_min_retail,
    max_retail_price = v_max_retail,
    min_purchase_price = v_min_purchase,
    updated_at = now()
  WHERE id = p_internal_sku_id;
END;
$$;

-- ==========================================
-- 2. CALCULATE INTERNAL SKU READINESS
-- ==========================================

CREATE OR REPLACE FUNCTION calculate_internal_sku_readiness(p_internal_sku_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_blocking_reasons text[] := ARRAY[]::text[];
  v_blocking_text_ru text[] := ARRAY[]::text[];
  v_blocking_text_uk text[] := ARRAY[]::text[];
  v_warnings text[] := ARRAY[]::text[];
  v_warnings_text_ru text[] := ARRAY[]::text[];
  v_warnings_text_uk text[] := ARRAY[]::text[];
  v_is_ready boolean := true;
  v_linked_count integer;
  v_internal_sku internal_skus%ROWTYPE;
BEGIN
  -- Get internal SKU data
  SELECT * INTO v_internal_sku FROM internal_skus WHERE id = p_internal_sku_id;

  -- Check if any supplier products are linked
  SELECT COUNT(*) INTO v_linked_count
  FROM sku_links
  WHERE internal_sku_id = p_internal_sku_id;

  IF v_linked_count = 0 THEN
    v_blocking_reasons := array_append(v_blocking_reasons, 'no_supplier_products');
    v_blocking_text_ru := array_append(v_blocking_text_ru, 'Нет привязанных товаров поставщиков');
    v_blocking_text_uk := array_append(v_blocking_text_uk, 'Немає прив''язаних товарів постачальників');
    v_is_ready := false;
  END IF;

  -- Check category
  IF v_internal_sku.internal_category_id IS NULL THEN
    v_blocking_reasons := array_append(v_blocking_reasons, 'no_internal_category');
    v_blocking_text_ru := array_append(v_blocking_text_ru, 'Не привязана внутренняя категория');
    v_blocking_text_uk := array_append(v_blocking_text_uk, 'Не прив''язана внутрішня категорія');
    v_is_ready := false;
  END IF;

  -- Check brand
  IF v_internal_sku.brand_ref IS NULL OR v_internal_sku.brand_ref = '' THEN
    v_warnings := array_append(v_warnings, 'no_brand');
    v_warnings_text_ru := array_append(v_warnings_text_ru, 'Не указан бренд');
    v_warnings_text_uk := array_append(v_warnings_text_uk, 'Не вказано бренд');
  END IF;

  -- Check stock
  IF v_internal_sku.total_stock = 0 THEN
    v_warnings := array_append(v_warnings, 'no_stock');
    v_warnings_text_ru := array_append(v_warnings_text_ru, 'Нет остатков на складах');
    v_warnings_text_uk := array_append(v_warnings_text_uk, 'Немає залишків на складах');
  END IF;

  -- Check prices
  IF v_internal_sku.min_retail_price IS NULL OR v_internal_sku.min_retail_price = 0 THEN
    v_blocking_reasons := array_append(v_blocking_reasons, 'no_retail_price');
    v_blocking_text_ru := array_append(v_blocking_text_ru, 'Нет розничной цены');
    v_blocking_text_uk := array_append(v_blocking_text_uk, 'Немає роздрібної ціни');
    v_is_ready := false;
  END IF;

  IF v_internal_sku.min_purchase_price IS NULL OR v_internal_sku.min_purchase_price = 0 THEN
    v_blocking_reasons := array_append(v_blocking_reasons, 'no_purchase_price');
    v_blocking_text_ru := array_append(v_blocking_text_ru, 'Нет закупочной цены');
    v_blocking_text_uk := array_append(v_blocking_text_uk, 'Немає закупівельної ціни');
    v_is_ready := false;
  END IF;

  -- Check images
  IF v_internal_sku.images IS NULL OR jsonb_array_length(v_internal_sku.images) = 0 THEN
    v_warnings := array_append(v_warnings, 'no_images');
    v_warnings_text_ru := array_append(v_warnings_text_ru, 'Нет изображений');
    v_warnings_text_uk := array_append(v_warnings_text_uk, 'Немає зображень');
  END IF;

  -- Update internal SKU
  UPDATE internal_skus
  SET 
    is_ready = v_is_ready,
    blocking_reasons = v_blocking_reasons,
    blocking_reasons_text = jsonb_build_object('ru', to_jsonb(v_blocking_text_ru), 'uk', to_jsonb(v_blocking_text_uk)),
    warnings = v_warnings,
    warnings_text = jsonb_build_object('ru', to_jsonb(v_warnings_text_ru), 'uk', to_jsonb(v_warnings_text_uk)),
    updated_at = now()
  WHERE id = p_internal_sku_id;
END;
$$;

-- ==========================================
-- 3. UPDATE INTERNAL SKU FROM PRIMARY LINK
-- ==========================================

CREATE OR REPLACE FUNCTION update_internal_sku_from_links(p_internal_sku_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_primary_product supplier_products%ROWTYPE;
BEGIN
  -- Get primary linked supplier product
  SELECT sp.* INTO v_primary_product
  FROM sku_links sl
  JOIN supplier_products sp ON sp.id = sl.supplier_product_id
  WHERE sl.internal_sku_id = p_internal_sku_id
  AND sl.is_primary = true
  LIMIT 1;

  IF v_primary_product.id IS NOT NULL THEN
    -- Update internal SKU with data from primary supplier product
    UPDATE internal_skus
    SET 
      name_ru = COALESCE(NULLIF(name_ru, ''), v_primary_product.name_ru),
      name_uk = COALESCE(NULLIF(name_uk, ''), v_primary_product.name_uk),
      description_ru = COALESCE(NULLIF(description_ru, ''), v_primary_product.description_ru),
      description_uk = COALESCE(NULLIF(description_uk, ''), v_primary_product.description_uk),
      internal_category_id = COALESCE(internal_category_id, v_primary_product.internal_category_id),
      brand_ref = COALESCE(NULLIF(brand_ref, ''), v_primary_product.brand_ref),
      barcode = COALESCE(NULLIF(barcode, ''), v_primary_product.barcode),
      vendor_code = COALESCE(NULLIF(vendor_code, ''), v_primary_product.vendor_code),
      images = CASE 
        WHEN images IS NULL OR jsonb_array_length(images) = 0 
        THEN v_primary_product.images 
        ELSE images 
      END,
      updated_at = now()
    WHERE id = p_internal_sku_id;
  END IF;

  -- Aggregate data
  PERFORM aggregate_internal_sku_data(p_internal_sku_id);
  
  -- Calculate readiness
  PERFORM calculate_internal_sku_readiness(p_internal_sku_id);
END;
$$;

-- ==========================================
-- 4. TRIGGERS FOR AUTO-AGGREGATION
-- ==========================================

-- Trigger to update internal SKU when SKU link is created/updated
CREATE OR REPLACE FUNCTION trigger_update_internal_sku_on_link()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update the internal SKU (run after transaction commits)
  PERFORM update_internal_sku_from_links(NEW.internal_sku_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_internal_sku_on_link_trigger ON sku_links;
CREATE TRIGGER update_internal_sku_on_link_trigger
  AFTER INSERT OR UPDATE ON sku_links
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_internal_sku_on_link();

-- Trigger to update internal SKU when supplier product is updated
CREATE OR REPLACE FUNCTION trigger_update_internal_sku_on_supplier_product()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_internal_sku_id uuid;
BEGIN
  -- Find linked internal SKUs and update them
  FOR v_internal_sku_id IN 
    SELECT internal_sku_id FROM sku_links WHERE supplier_product_id = NEW.id
  LOOP
    PERFORM update_internal_sku_from_links(v_internal_sku_id);
  END LOOP;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_internal_sku_on_supplier_product_trigger ON supplier_products;
CREATE TRIGGER update_internal_sku_on_supplier_product_trigger
  AFTER UPDATE ON supplier_products
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_internal_sku_on_supplier_product();

-- ==========================================
-- 5. INITIAL AGGREGATION FOR MIGRATED DATA
-- ==========================================

-- Update all internal SKUs from their links (in batches to avoid timeout)
DO $$
DECLARE
  v_sku_id uuid;
  v_count integer := 0;
BEGIN
  FOR v_sku_id IN SELECT id FROM internal_skus ORDER BY id LIMIT 500
  LOOP
    PERFORM update_internal_sku_from_links(v_sku_id);
    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'Updated % internal SKUs', v_count;
END $$;
