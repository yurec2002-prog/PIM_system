/*
  # Update Quality Calculation for New Schema

  1. Changes
    - Update calculate_product_quality function to work with refactored schema
    - Use category_id instead of supplier_category_id
    - Check for retail.current and purchase.cash.current prices
    - Update both product_quality_scores and products tables
    - Check for name_uk or name_ru
    - Check for description

  2. Quality Scoring Rules
    - Category assigned: 15%
    - Images available: 15%
    - Name exists: 15%
    - Description exists: 10%
    - Retail price set: 15%
    - Purchase price set: 15%
    - Barcode exists: 10%
    - Stock > 0: 5%
    Total: 100%
*/

CREATE OR REPLACE FUNCTION calculate_product_quality(p_product_id integer)
RETURNS void AS $$
DECLARE
  v_product record;
  v_score integer := 0;
  v_reasons jsonb := '[]'::jsonb;
  v_has_retail_price boolean := false;
  v_has_purchase_price boolean := false;
  v_has_images boolean := false;
  v_has_category boolean := false;
  v_has_name boolean := false;
  v_has_description boolean := false;
  v_has_barcode boolean := false;
  v_has_stock boolean := false;
  v_is_ready boolean := false;
BEGIN
  SELECT * INTO v_product FROM products WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Check if category is assigned (15%)
  IF v_product.category_id IS NOT NULL THEN
    v_has_category := true;
    v_score := v_score + 15;
  ELSE
    v_reasons := v_reasons || jsonb_build_object('code', 'no_category', 'message', 'Category not assigned');
  END IF;

  -- Check images (15%)
  IF jsonb_array_length(v_product.images) > 0 THEN
    v_has_images := true;
    v_score := v_score + 15;
  ELSE
    v_reasons := v_reasons || jsonb_build_object('code', 'no_images', 'message', 'No product images');
  END IF;

  -- Check name (15%)
  IF COALESCE(v_product.name_uk, '') != '' OR COALESCE(v_product.name_ru, '') != '' THEN
    v_has_name := true;
    v_score := v_score + 15;
  ELSE
    v_reasons := v_reasons || jsonb_build_object('code', 'no_name', 'message', 'Product name missing');
  END IF;

  -- Check description (10%)
  IF COALESCE(v_product.description_uk, '') != '' OR COALESCE(v_product.description_ru, '') != '' THEN
    v_has_description := true;
    v_score := v_score + 10;
  ELSE
    v_reasons := v_reasons || jsonb_build_object('code', 'no_description', 'message', 'Product description missing');
  END IF;

  -- Check retail price (15%)
  IF EXISTS (
    SELECT 1 FROM product_prices
    WHERE product_id = p_product_id
    AND price_type = 'retail.current'
    AND value > 0
  ) THEN
    v_has_retail_price := true;
    v_score := v_score + 15;
  ELSE
    v_reasons := v_reasons || jsonb_build_object('code', 'no_retail_price', 'message', 'Retail price not set');
  END IF;

  -- Check purchase price (15%)
  IF EXISTS (
    SELECT 1 FROM product_prices
    WHERE product_id = p_product_id
    AND price_type = 'purchase.cash.current'
    AND value > 0
  ) THEN
    v_has_purchase_price := true;
    v_score := v_score + 15;
  ELSE
    v_reasons := v_reasons || jsonb_build_object('code', 'no_purchase_price', 'message', 'Purchase price not set');
  END IF;

  -- Check barcode (10%)
  IF COALESCE(v_product.barcode, '') != '' THEN
    v_has_barcode := true;
    v_score := v_score + 10;
  ELSE
    v_reasons := v_reasons || jsonb_build_object('code', 'no_barcode', 'message', 'Barcode missing');
  END IF;

  -- Check stock (5%)
  IF v_product.total_stock > 0 THEN
    v_has_stock := true;
    v_score := v_score + 5;
  ELSE
    v_reasons := v_reasons || jsonb_build_object('code', 'no_stock', 'message', 'No stock available');
  END IF;

  -- Product is ready if score >= 80%
  v_is_ready := v_score >= 80;

  -- Store quality data in product_quality_scores table
  INSERT INTO product_quality_scores (
    product_id, completeness_score, not_ready_reasons,
    has_selling_price, has_images, has_category, has_required_attributes,
    calculated_at
  ) VALUES (
    p_product_id, v_score, v_reasons,
    v_has_retail_price, v_has_images, v_has_category, true,
    now()
  )
  ON CONFLICT (product_id) DO UPDATE SET
    completeness_score = EXCLUDED.completeness_score,
    not_ready_reasons = EXCLUDED.not_ready_reasons,
    has_selling_price = EXCLUDED.has_selling_price,
    has_images = EXCLUDED.has_images,
    has_category = EXCLUDED.has_category,
    has_required_attributes = EXCLUDED.has_required_attributes,
    calculated_at = EXCLUDED.calculated_at;

  -- Update products table with calculated values
  UPDATE products
  SET
    completeness_score = v_score,
    is_ready = v_is_ready,
    updated_at = now()
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger to recalculate quality on product changes
DROP TRIGGER IF EXISTS trigger_recalculate_product_quality ON products;

-- Recreate trigger to recalculate quality on price changes
DROP TRIGGER IF EXISTS trigger_recalculate_quality_on_price_change ON product_prices;

CREATE OR REPLACE FUNCTION recalculate_quality_on_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM calculate_product_quality(OLD.product_id);
  ELSE
    PERFORM calculate_product_quality(NEW.product_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_recalculate_quality_on_price_change
  AFTER INSERT OR UPDATE OR DELETE ON product_prices
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_quality_on_price_change();
