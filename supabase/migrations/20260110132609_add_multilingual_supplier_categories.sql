/*
  # Add Multilingual Support to Supplier Categories

  ## Overview
  This migration adds Russian and Ukrainian name fields to supplier_categories
  to support multilingual category names from Sandi JSON feeds.

  ## Changes
  1. **supplier_categories Table**
    - Add `name_ru` (text) - Russian category name
    - Add `name_uk` (text) - Ukrainian category name
    - Keep existing `name` field for compatibility (will be populated with name_ru)

  ## Security
  - No changes to RLS policies
*/

-- Add multilingual name fields to supplier_categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_categories' AND column_name = 'name_ru'
  ) THEN
    ALTER TABLE supplier_categories ADD COLUMN name_ru text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_categories' AND column_name = 'name_uk'
  ) THEN
    ALTER TABLE supplier_categories ADD COLUMN name_uk text DEFAULT '';
  END IF;
END $$;
