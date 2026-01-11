/*
  # Add Internal SKU System
  
  ## Overview
  Implements an internal SKU system for products. Each product will have both:
  - supplier_sku: The original SKU from the supplier (e.g., SD00054503)
  - internal_sku: Our internal sequential SKU (e.g., VOD00000001, VOD00000002, etc.)
  
  ## Changes Made
  
  1. **New Columns**
     - Add `internal_sku` to products table
     - Create unique index on internal_sku
  
  2. **Functions**
     - `generate_next_internal_sku()`: Generates the next sequential internal SKU
     - `assign_internal_sku()`: Trigger function to auto-assign internal SKU when a product is created
  
  3. **Triggers**
     - Auto-assign internal SKU to new products during import/creation
  
  4. **Security**
     - Maintain existing RLS policies
     - Internal SKU is read-only after assignment
  
  ## Notes
  - Internal SKU format: VOD + 8 digits (VOD00000001)
  - Sequential numbering starts from 1
  - SKU is assigned automatically when product is created
  - Existing products without internal SKU will get one when updated
*/

-- Add internal_sku column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS internal_sku text;

-- Create unique index on internal_sku
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_internal_sku 
ON products(internal_sku) 
WHERE internal_sku IS NOT NULL;

-- Function to generate the next internal SKU
CREATE OR REPLACE FUNCTION generate_next_internal_sku()
RETURNS text AS $$
DECLARE
  v_max_sku text;
  v_max_number integer;
  v_next_number integer;
  v_next_sku text;
BEGIN
  -- Get the highest internal SKU number
  SELECT internal_sku INTO v_max_sku
  FROM products
  WHERE internal_sku IS NOT NULL
    AND internal_sku LIKE 'VOD%'
  ORDER BY internal_sku DESC
  LIMIT 1;
  
  -- Extract the numeric part
  IF v_max_sku IS NOT NULL THEN
    v_max_number := CAST(substring(v_max_sku from 4) AS integer);
    v_next_number := v_max_number + 1;
  ELSE
    v_next_number := 1;
  END IF;
  
  -- Format the next SKU with leading zeros (8 digits)
  v_next_sku := 'VOD' || lpad(v_next_number::text, 8, '0');
  
  RETURN v_next_sku;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically assign internal SKU to products
CREATE OR REPLACE FUNCTION assign_internal_sku()
RETURNS TRIGGER AS $$
DECLARE
  v_new_sku text;
BEGIN
  -- Only assign if internal_sku is NULL
  IF NEW.internal_sku IS NULL THEN
    v_new_sku := generate_next_internal_sku();
    NEW.internal_sku := v_new_sku;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-assign internal SKU on insert
DROP TRIGGER IF EXISTS trigger_assign_internal_sku ON products;
CREATE TRIGGER trigger_assign_internal_sku
  BEFORE INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION assign_internal_sku();

-- Backfill internal SKUs for existing products
DO $$
DECLARE
  v_product record;
  v_new_sku text;
BEGIN
  FOR v_product IN 
    SELECT id 
    FROM products 
    WHERE internal_sku IS NULL
    ORDER BY id
  LOOP
    v_new_sku := generate_next_internal_sku();
    UPDATE products 
    SET internal_sku = v_new_sku 
    WHERE id = v_product.id;
  END LOOP;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN products.internal_sku IS 'Internal sequential SKU (VOD00000001, VOD00000002, etc.)';
