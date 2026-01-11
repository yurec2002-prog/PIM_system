/*
  # Update Variant Prices to Support Flexible Price Types

  ## Overview
  This migration removes the restrictive CHECK constraint on the price_type column
  to allow flexible price paths like "retail.current", "purchase.cash.current", etc.

  ## Changes
  1. **variant_prices Table**
    - Remove CHECK constraint on price_type column
    - Allow any string value for price_type to support nested paths

  ## Security
  - No changes to RLS policies
*/

-- Drop the existing CHECK constraint on price_type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'variant_prices_price_type_check'
  ) THEN
    ALTER TABLE variant_prices DROP CONSTRAINT variant_prices_price_type_check;
  END IF;
END $$;
