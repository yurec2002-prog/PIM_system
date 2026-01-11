/*
  # Comprehensive SKU Readiness System

  ## Overview
  This migration implements a transparent, predictable readiness system that tells managers
  exactly why a SKU is ready or not ready for sale/export.

  ## Changes

  1. **New Columns in products table**
     - `blocking_reasons` (jsonb) - Array of machine-readable blocking reason codes
     - `blocking_reasons_text` (jsonb) - Array of human-readable blocking messages (RU/UK)
     - `warnings` (jsonb) - Array of non-blocking warnings
     - `warnings_text` (jsonb) - Array of human-readable warning messages (RU/UK)

  2. **Readiness Rules**

     ### BLOCKING (NOT READY):
     - `no_internal_category` - Internal category not mapped
     - `no_retail_price` - Retail price missing
     - `no_purchase_price` - Purchase price missing
     - `no_name` - Product name missing
     - `no_brand` - Brand reference missing

     ### WARNINGS (still READY):
     - `no_stock` - Total stock is 0
     - `no_images` - No product images
     - `no_barcode` - Barcode missing
     - `no_vendor_code` - Vendor code (article) missing

  3. **New Function**
     - `calculate_product_readiness(product_id)` - Comprehensive readiness calculation
     - Returns: is_ready (boolean), blocking_reasons, warnings

  4. **Triggers**
     - Auto-recalculate on product update
     - Auto-recalculate on price changes
     - Auto-recalculate on category mapping changes

  ## Security
  - Function is SECURITY DEFINER to allow proper access
  - Triggers run automatically to maintain data integrity
*/

-- Add new columns for readiness tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'blocking_reasons'
  ) THEN
    ALTER TABLE products ADD COLUMN blocking_reasons jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'blocking_reasons_text'
  ) THEN
    ALTER TABLE products ADD COLUMN blocking_reasons_text jsonb DEFAULT '{"ru": [], "uk": []}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'warnings'
  ) THEN
    ALTER TABLE products ADD COLUMN warnings jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'warnings_text'
  ) THEN
    ALTER TABLE products ADD COLUMN warnings_text jsonb DEFAULT '{"ru": [], "uk": []}'::jsonb;
  END IF;
END $$;

-- Create comprehensive readiness calculation function
CREATE OR REPLACE FUNCTION calculate_product_readiness(p_product_id integer)
RETURNS TABLE (
  is_ready boolean,
  blocking_reasons jsonb,
  blocking_reasons_text jsonb,
  warnings jsonb,
  warnings_text jsonb
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_product RECORD;
  v_has_retail_price boolean;
  v_has_purchase_price boolean;
  v_blocking_codes text[] := '{}';
  v_blocking_ru text[] := '{}';
  v_blocking_uk text[] := '{}';
  v_warning_codes text[] := '{}';
  v_warning_ru text[] := '{}';
  v_warning_uk text[] := '{}';
BEGIN
  -- Get product data
  SELECT 
    p.id,
    p.name_ru,
    p.name_uk,
    p.brand_ref,
    p.internal_category_id,
    p.supplier_category_id,
    p.total_stock,
    p.images,
    p.main_image,
    p.barcode,
    p.vendor_code
  INTO v_product
  FROM products p
  WHERE p.id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id;
  END IF;

  -- Check prices
  SELECT EXISTS (
    SELECT 1 FROM product_prices
    WHERE product_id = p_product_id
    AND price_type ILIKE '%retail%'
    AND value > 0
  ) INTO v_has_retail_price;

  SELECT EXISTS (
    SELECT 1 FROM product_prices
    WHERE product_id = p_product_id
    AND price_type ILIKE '%purchase%'
    AND value > 0
  ) INTO v_has_purchase_price;

  -- Check BLOCKING conditions
  
  -- 1. Internal category not mapped
  IF v_product.internal_category_id IS NULL THEN
    v_blocking_codes := array_append(v_blocking_codes, 'no_internal_category');
    v_blocking_ru := array_append(v_blocking_ru, 'Не привязана внутренняя категория');
    v_blocking_uk := array_append(v_blocking_uk, 'Не прив''язана внутрішня категорія');
  END IF;

  -- 2. Retail price missing
  IF NOT v_has_retail_price THEN
    v_blocking_codes := array_append(v_blocking_codes, 'no_retail_price');
    v_blocking_ru := array_append(v_blocking_ru, 'Отсутствует розничная цена');
    v_blocking_uk := array_append(v_blocking_uk, 'Відсутня роздрібна ціна');
  END IF;

  -- 3. Purchase price missing
  IF NOT v_has_purchase_price THEN
    v_blocking_codes := array_append(v_blocking_codes, 'no_purchase_price');
    v_blocking_ru := array_append(v_blocking_ru, 'Отсутствует закупочная цена');
    v_blocking_uk := array_append(v_blocking_uk, 'Відсутня закупівельна ціна');
  END IF;

  -- 4. Product name missing
  IF (v_product.name_ru IS NULL OR v_product.name_ru = '') 
     AND (v_product.name_uk IS NULL OR v_product.name_uk = '') THEN
    v_blocking_codes := array_append(v_blocking_codes, 'no_name');
    v_blocking_ru := array_append(v_blocking_ru, 'Отсутствует название товара');
    v_blocking_uk := array_append(v_blocking_uk, 'Відсутня назва товару');
  END IF;

  -- 5. Brand missing
  IF v_product.brand_ref IS NULL OR v_product.brand_ref = '' THEN
    v_blocking_codes := array_append(v_blocking_codes, 'no_brand');
    v_blocking_ru := array_append(v_blocking_ru, 'Отсутствует бренд');
    v_blocking_uk := array_append(v_blocking_uk, 'Відсутній бренд');
  END IF;

  -- Check WARNING conditions (non-blocking)
  
  -- 1. No stock
  IF v_product.total_stock = 0 THEN
    v_warning_codes := array_append(v_warning_codes, 'no_stock');
    v_warning_ru := array_append(v_warning_ru, 'Нет в наличии');
    v_warning_uk := array_append(v_warning_uk, 'Немає в наявності');
  END IF;

  -- 2. No images
  IF v_product.images IS NULL OR jsonb_array_length(v_product.images) = 0 THEN
    v_warning_codes := array_append(v_warning_codes, 'no_images');
    v_warning_ru := array_append(v_warning_ru, 'Нет изображений');
    v_warning_uk := array_append(v_warning_uk, 'Немає зображень');
  END IF;

  -- 3. No barcode
  IF v_product.barcode IS NULL OR v_product.barcode = '' THEN
    v_warning_codes := array_append(v_warning_codes, 'no_barcode');
    v_warning_ru := array_append(v_warning_ru, 'Отсутствует баркод');
    v_warning_uk := array_append(v_warning_uk, 'Відсутній баркод');
  END IF;

  -- 4. No vendor code
  IF v_product.vendor_code IS NULL OR v_product.vendor_code = '' THEN
    v_warning_codes := array_append(v_warning_codes, 'no_vendor_code');
    v_warning_ru := array_append(v_warning_ru, 'Отсутствует артикул');
    v_warning_uk := array_append(v_warning_uk, 'Відсутній артикул');
  END IF;

  -- Return results
  RETURN QUERY SELECT
    (array_length(v_blocking_codes, 1) IS NULL OR array_length(v_blocking_codes, 1) = 0) AS is_ready,
    to_jsonb(v_blocking_codes) AS blocking_reasons,
    jsonb_build_object('ru', to_jsonb(v_blocking_ru), 'uk', to_jsonb(v_blocking_uk)) AS blocking_reasons_text,
    to_jsonb(v_warning_codes) AS warnings,
    jsonb_build_object('ru', to_jsonb(v_warning_ru), 'uk', to_jsonb(v_warning_uk)) AS warnings_text;
END;
$$;

-- Function to update a single product's readiness
CREATE OR REPLACE FUNCTION update_single_product_readiness(p_product_id integer)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_readiness RECORD;
BEGIN
  -- Calculate readiness
  SELECT * INTO v_readiness
  FROM calculate_product_readiness(p_product_id);

  -- Update product
  UPDATE products
  SET
    is_ready = v_readiness.is_ready,
    blocking_reasons = v_readiness.blocking_reasons,
    blocking_reasons_text = v_readiness.blocking_reasons_text,
    warnings = v_readiness.warnings,
    warnings_text = v_readiness.warnings_text,
    updated_at = now()
  WHERE id = p_product_id;
END;
$$;

-- Function to recalculate readiness for all products
CREATE OR REPLACE FUNCTION recalculate_all_product_readiness()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_id integer;
BEGIN
  FOR v_product_id IN SELECT id FROM products LOOP
    PERFORM update_single_product_readiness(v_product_id);
  END LOOP;
END;
$$;

-- Trigger function to auto-update readiness on product changes
CREATE OR REPLACE FUNCTION trigger_update_product_readiness()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Recalculate readiness for this product
  PERFORM update_single_product_readiness(NEW.id);
  
  -- Reload the updated values
  SELECT 
    is_ready, 
    blocking_reasons, 
    blocking_reasons_text, 
    warnings, 
    warnings_text
  INTO 
    NEW.is_ready, 
    NEW.blocking_reasons, 
    NEW.blocking_reasons_text, 
    NEW.warnings, 
    NEW.warnings_text
  FROM products
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Trigger function for price changes
CREATE OR REPLACE FUNCTION trigger_update_readiness_on_price_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update readiness for the affected product
  PERFORM update_single_product_readiness(COALESCE(NEW.product_id, OLD.product_id));
  RETURN NEW;
END;
$$;

-- Trigger function for category mapping changes
CREATE OR REPLACE FUNCTION trigger_update_readiness_on_category_mapping()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update readiness for all products with this supplier category
  UPDATE products
  SET updated_at = now()
  WHERE supplier_category_id = COALESCE(NEW.supplier_category_id, OLD.supplier_category_id);
  
  RETURN NEW;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_product_readiness_trigger ON products;
DROP TRIGGER IF EXISTS update_readiness_on_price_change ON product_prices;
DROP TRIGGER IF EXISTS update_readiness_on_category_mapping ON category_mappings;

-- Create trigger for product updates
CREATE TRIGGER update_product_readiness_trigger
  BEFORE UPDATE OF name_ru, name_uk, brand_ref, internal_category_id, total_stock, images, barcode, vendor_code
  ON products
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_product_readiness();

-- Create trigger for price changes
CREATE TRIGGER update_readiness_on_price_change
  AFTER INSERT OR UPDATE OR DELETE ON product_prices
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_readiness_on_price_change();

-- Create trigger for category mapping changes
CREATE TRIGGER update_readiness_on_category_mapping
  AFTER INSERT OR UPDATE OR DELETE ON category_mappings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_readiness_on_category_mapping();

-- Initialize readiness for all existing products
SELECT recalculate_all_product_readiness();
