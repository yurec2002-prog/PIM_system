/*
  # Add supplier_category_id to products table

  1. Changes
    - Add `supplier_category_id` column to products table
    - This links products to their supplier categories for proper attribute mapping

  2. Security
    - No RLS changes needed
*/

-- Add supplier_category_id column to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'supplier_category_id'
  ) THEN
    ALTER TABLE products ADD COLUMN supplier_category_id uuid REFERENCES supplier_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_supplier_category_id ON products(supplier_category_id);
