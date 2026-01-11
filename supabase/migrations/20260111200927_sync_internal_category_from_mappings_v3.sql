/*
  # Sync internal_category_id from category mappings (v3)

  ## Problem
  Products have supplier_category_id that is mapped to internal_category_id via category_mappings table,
  but the products.internal_category_id field is not being populated automatically.
  This causes the readiness check to incorrectly flag products as "no internal category".

  ## Solution
  Use a simpler approach: 
  1. Update all existing products to populate internal_category_id
  2. Create a BEFORE trigger to sync category on INSERT/UPDATE (without calling other updates)
  3. Keep existing readiness triggers as AFTER triggers
  4. Update category mapping trigger to sync products

  ## Changes
  - New BEFORE trigger for syncing category
  - Convert readiness trigger to AFTER
  - Update category mapping trigger
  - Bulk update existing products
*/

-- Function to sync internal_category_id (BEFORE trigger, no updates)
CREATE OR REPLACE FUNCTION sync_product_category_before()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Sync internal_category_id from mapping
  IF NEW.supplier_category_id IS NOT NULL THEN
    SELECT cm.internal_category_id
    INTO NEW.internal_category_id
    FROM category_mappings cm
    WHERE cm.supplier_category_id = NEW.supplier_category_id;
  ELSE
    NEW.internal_category_id := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to update readiness (AFTER trigger)
CREATE OR REPLACE FUNCTION update_product_readiness_after()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Recalculate readiness after the row is committed
  PERFORM update_single_product_readiness(NEW.id);
  RETURN NEW;
END;
$$;

-- Drop existing readiness trigger
DROP TRIGGER IF EXISTS update_product_readiness_trigger ON products;

-- Create BEFORE trigger for category sync (runs first)
DROP TRIGGER IF EXISTS sync_product_category_trigger ON products;
CREATE TRIGGER sync_product_category_trigger
  BEFORE INSERT OR UPDATE OF supplier_category_id ON products
  FOR EACH ROW
  EXECUTE FUNCTION sync_product_category_before();

-- Create AFTER trigger for readiness calculation (runs after row is committed)
CREATE TRIGGER update_product_readiness_after_trigger
  AFTER INSERT OR UPDATE OF name_ru, name_uk, brand_ref, internal_category_id, supplier_category_id, total_stock, images, barcode, vendor_code ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_product_readiness_after();

-- Update category mapping trigger
CREATE OR REPLACE FUNCTION trigger_update_readiness_on_category_mapping()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update internal_category_id for all products with this supplier category
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE products
    SET 
      internal_category_id = NEW.internal_category_id,
      updated_at = now()
    WHERE supplier_category_id = NEW.supplier_category_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE products
    SET 
      internal_category_id = NULL,
      updated_at = now()
    WHERE supplier_category_id = OLD.supplier_category_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Sync all existing products with mapped categories
UPDATE products p
SET internal_category_id = cm.internal_category_id
FROM category_mappings cm
WHERE p.supplier_category_id = cm.supplier_category_id
  AND (p.internal_category_id IS NULL OR p.internal_category_id != cm.internal_category_id);

-- Recalculate readiness for all products
SELECT recalculate_all_product_readiness();
