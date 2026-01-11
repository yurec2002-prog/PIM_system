/*
  # Fix infinite recursion in quality calculation trigger

  1. Changes
    - Remove UPDATE products from calculate_product_quality function
    - Store quality data only in product_quality_scores table
    - This prevents infinite recursion from trigger
*/

CREATE OR REPLACE FUNCTION calculate_product_quality(p_product_id integer)
RETURNS void AS $$
DECLARE
  v_product record;
  v_template record;
  v_score integer := 0;
  v_reasons jsonb := '[]'::jsonb;
  v_has_selling_price boolean := false;
  v_has_images boolean := false;
  v_has_category boolean := false;
  v_has_required_attributes boolean := true;
BEGIN
  SELECT * INTO v_product FROM products WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Check if supplier category is assigned
  IF v_product.supplier_category_id IS NOT NULL THEN
    v_has_category := true;
    v_score := v_score + 25;
  ELSE
    v_reasons := v_reasons || jsonb_build_object('code', 'no_category', 'message', 'Category not assigned');
  END IF;

  -- Check images
  IF jsonb_array_length(v_product.images) > 0 THEN
    v_has_images := true;
    v_score := v_score + 25;
  ELSE
    v_reasons := v_reasons || jsonb_build_object('code', 'no_images', 'message', 'No product images');
  END IF;

  -- Check selling price
  IF EXISTS (SELECT 1 FROM product_prices WHERE product_id = p_product_id AND price_type = 'selling' AND value > 0) THEN
    v_has_selling_price := true;
    v_score := v_score + 25;
  ELSE
    v_reasons := v_reasons || jsonb_build_object('code', 'no_selling_price', 'message', 'Selling price not set');
  END IF;

  -- Check category quality template if category is mapped to internal category
  IF v_has_category THEN
    -- Get internal category id through category mapping
    SELECT ct.* INTO v_template 
    FROM category_quality_templates ct
    INNER JOIN category_mappings cm ON cm.internal_category_id = ct.category_id
    WHERE cm.supplier_category_id = v_product.supplier_category_id;
    
    IF FOUND THEN
      IF jsonb_array_length(v_product.images) < v_template.minimum_image_count THEN
        v_reasons := v_reasons || jsonb_build_object(
          'code', 'insufficient_images',
          'message', format('Need at least %s images', v_template.minimum_image_count)
        );
        v_has_required_attributes := false;
      END IF;
    END IF;
  END IF;

  -- Check stock
  IF v_product.total_stock >= 0 THEN
    v_score := v_score + 25;
  ELSE
    v_reasons := v_reasons || jsonb_build_object('code', 'invalid_stock', 'message', 'Stock quantity is invalid');
  END IF;

  -- Store quality data in product_quality_scores table only (no UPDATE on products to avoid recursion)
  INSERT INTO product_quality_scores (
    product_id, completeness_score, not_ready_reasons,
    has_selling_price, has_images, has_category, has_required_attributes,
    calculated_at
  ) VALUES (
    p_product_id, v_score, v_reasons,
    v_has_selling_price, v_has_images, v_has_category, v_has_required_attributes,
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
END;
$$ LANGUAGE plpgsql;