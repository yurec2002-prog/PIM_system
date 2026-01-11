/*
  # Remove old category_id from products table

  ## Changes
  - Drop old category_id column that references the old categories table
  - Keep only supplier_category_id which references supplier_categories

  ## Reason
  The old category_id field conflicts with the new architecture where:
  - supplier_category_id points to supplier_categories (supplier's category tree)
  - internal_category_id points to internal_categories (company's category tree)
*/

-- Drop the old foreign key constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'products_category_id_fkey' 
    AND table_name = 'products'
  ) THEN
    ALTER TABLE products DROP CONSTRAINT products_category_id_fkey;
  END IF;
END $$;

-- Drop the old category_id column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE products DROP COLUMN category_id;
  END IF;
END $$;

-- Drop the old categories table as it's no longer needed
DROP TABLE IF EXISTS categories CASCADE;
