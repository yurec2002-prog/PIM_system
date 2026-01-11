/*
  # Add Product Readiness Function
  
  1. New Function
    - `update_product_readiness_for_supplier(supplier_uuid)` - Updates is_ready flag for all products
      
  2. Readiness Criteria
    - Product must have at least one variant
    - Variant must have a supplier category
    - Supplier category must be mapped to an internal category
    - Variant must have at least one image
    - Variant must have a positive price
    
  3. Changes
    - Updates products.is_ready based on readiness criteria
    - Updates products.internal_category_id from mapped category
*/

-- Function to update product readiness
CREATE OR REPLACE FUNCTION update_product_readiness_for_supplier(supplier_uuid uuid)
RETURNS void AS $$
BEGIN
  -- Update internal_category_id and is_ready for all products of this supplier
  UPDATE products p
  SET 
    internal_category_id = (
      SELECT cm.internal_category_id
      FROM variants v
      JOIN category_mappings cm ON v.supplier_category_id = cm.supplier_category_id
      WHERE v.product_id = p.id
      LIMIT 1
    ),
    is_ready = (
      -- Product is ready if it has at least one complete variant
      EXISTS (
        SELECT 1
        FROM variants v
        WHERE v.product_id = p.id
          AND v.supplier_category_id IS NOT NULL
          AND v.price > 0
          AND EXISTS (
            SELECT 1 FROM variant_images vi WHERE vi.variant_id = v.id
          )
          AND EXISTS (
            SELECT 1 
            FROM category_mappings cm 
            WHERE cm.supplier_category_id = v.supplier_category_id
          )
      )
    ),
    updated_at = now()
  WHERE p.supplier_id = supplier_uuid;
END;
$$ LANGUAGE plpgsql;