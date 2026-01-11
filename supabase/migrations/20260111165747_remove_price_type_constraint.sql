/*
  # Remove Price Type Constraint for Flexible Price Paths

  ## Overview
  This migration removes the restrictive CHECK constraint on the price_type column
  in product_prices table to allow flexible price paths like "retail.current", 
  "purchase.cash.current", "retail.old", "purchase.cash.old", etc.

  ## Changes
  1. **product_prices Table**
    - Remove CHECK constraint on price_type column
    - Allow any string value for price_type to support nested price paths
    - Remove UNIQUE constraint to allow multiple price types (e.g., current and old)

  ## Security
  - No changes to RLS policies
*/

-- Drop the UNIQUE constraint that prevents multiple prices per product
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'product_prices_product_id_price_type_key'
  ) THEN
    ALTER TABLE product_prices DROP CONSTRAINT product_prices_product_id_price_type_key;
  END IF;
END $$;

-- Drop the CHECK constraint on price_type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'product_prices_price_type_check'
  ) THEN
    ALTER TABLE product_prices DROP CONSTRAINT product_prices_price_type_check;
  END IF;
END $$;
