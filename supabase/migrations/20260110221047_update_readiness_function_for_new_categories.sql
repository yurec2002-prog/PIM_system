/*
  # Update product readiness function for new category structure

  ## Changes
  - Update function to use supplier_category_id instead of category_id
  - Check if product is ready based on new architecture
*/

CREATE OR REPLACE FUNCTION update_product_readiness_for_supplier(supplier_uuid uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE products p
  SET
    is_ready = (
      p.name_ru IS NOT NULL AND p.name_ru != '' AND
      p.description_ru IS NOT NULL AND p.description_ru != '' AND
      p.main_image IS NOT NULL AND p.main_image != '' AND
      p.supplier_category_id IS NOT NULL AND
      p.total_stock > 0 AND
      EXISTS (
        SELECT 1 FROM product_prices pp
        WHERE pp.product_id = p.id AND pp.price_type = 'retail_rrp'
      )
    ),
    completeness_score = (
      CASE WHEN p.name_ru IS NOT NULL AND p.name_ru != '' THEN 15 ELSE 0 END +
      CASE WHEN p.name_uk IS NOT NULL AND p.name_uk != '' THEN 10 ELSE 0 END +
      CASE WHEN p.description_ru IS NOT NULL AND p.description_ru != '' THEN 20 ELSE 0 END +
      CASE WHEN p.description_uk IS NOT NULL AND p.description_uk != '' THEN 15 ELSE 0 END +
      CASE WHEN p.main_image IS NOT NULL AND p.main_image != '' THEN 15 ELSE 0 END +
      CASE WHEN p.supplier_category_id IS NOT NULL THEN 10 ELSE 0 END +
      CASE WHEN p.total_stock > 0 THEN 10 ELSE 0 END +
      CASE WHEN EXISTS (
        SELECT 1 FROM product_prices pp
        WHERE pp.product_id = p.id AND pp.price_type = 'retail_rrp'
      ) THEN 5 ELSE 0 END
    )
  FROM suppliers s
  WHERE s.id = supplier_uuid AND p.supplier = s.code;
END;
$$;
