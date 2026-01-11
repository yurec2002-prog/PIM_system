/*
  # Fix Quality Calculation - Check Category Mapping

  1. Changes
    - Update calculate_product_quality to check category mapping
    - Instead of checking internal_category_id directly, check if supplier_category has mapping
    - Update products.completeness_score and is_ready with old/new value comparison to avoid unnecessary updates
    - System scoring: category 15%, images 15%, name 15%, description 10%, retail price 15%, purchase price 15%, barcode 10%, stock 5%
    - Ready threshold: 80%
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
  v_old_score integer;
  v_old_ready boolean;
BEGIN
  SELECT * INTO v_product FROM products WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Store old values to check if update is needed
  v_old_score := v_product.completeness_score;
  v_old_ready := v_product.is_ready;

  -- Check if category is mapped (15%)
  -- Check both internal_category_id and supplier_category mapping
  IF v_product.internal_category_id IS NOT NULL THEN
    v_has_category := true;
    v_score := v_score + 15;
  ELSIF v_product.supplier_category_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM category_mappings 
    WHERE supplier_category_id = v_product.supplier_category_id
  ) THEN
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

  -- Update products table ONLY if values changed (prevents unnecessary updates and recursion)
  IF v_old_score != v_score OR v_old_ready != v_is_ready THEN
    UPDATE products
    SET
      completeness_score = v_score,
      is_ready = v_is_ready,
      updated_at = now()
    WHERE id = p_product_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
