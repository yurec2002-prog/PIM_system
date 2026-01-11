/*
  # Update Product Readiness Function to Include Stock Check

  ## Overview
  This migration updates the product readiness function to ensure stock is checked.

  ## Changes
  - Product is ready only if:
    1. Supplier category is mapped to internal category
    2. At least 1 price exists (from variant_prices table)
    3. At least 1 image exists
    4. Stock is known (stock_quantity is not null)

  ## Notes
  - This ensures products without stock information are marked as not ready
  - Aligns with PIM manager requirements for product completeness
*/

-- Drop existing function
DROP FUNCTION IF EXISTS update_product_readiness_for_supplier(uuid);

-- Recreate function with stock check
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
          AND v.stock_quantity IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM variant_prices vp WHERE vp.variant_id = v.id
          )
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
