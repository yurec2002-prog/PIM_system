/*
  # Add Multilingual Support and Pinning to Attributes
  
  1. Changes to `attributes` table
    - Add `name_ru` (text) - Russian name
    - Add `name_uk` (text) - Ukrainian name
  
  2. Changes to `variant_attributes` table
    - Add `value_ru` (text) - Russian value
    - Add `value_uk` (text) - Ukrainian value
    - Add `numeric_value` (numeric) - Normalized numeric value for sorting/filtering
    - Add `is_pinned` (boolean) - Flag to pin important attributes to top
  
  3. Notes
    - All new columns are nullable for backward compatibility
    - numeric_value auto-detects comma decimals and stores normalized value
    - is_pinned defaults to false
*/

-- Add multilingual fields to attributes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attributes' AND column_name = 'name_ru'
  ) THEN
    ALTER TABLE attributes ADD COLUMN name_ru text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attributes' AND column_name = 'name_uk'
  ) THEN
    ALTER TABLE attributes ADD COLUMN name_uk text;
  END IF;
END $$;

-- Add multilingual fields, numeric value, and pinning to variant_attributes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'variant_attributes' AND column_name = 'value_ru'
  ) THEN
    ALTER TABLE variant_attributes ADD COLUMN value_ru text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'variant_attributes' AND column_name = 'value_uk'
  ) THEN
    ALTER TABLE variant_attributes ADD COLUMN value_uk text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'variant_attributes' AND column_name = 'numeric_value'
  ) THEN
    ALTER TABLE variant_attributes ADD COLUMN numeric_value numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'variant_attributes' AND column_name = 'is_pinned'
  ) THEN
    ALTER TABLE variant_attributes ADD COLUMN is_pinned boolean DEFAULT false;
  END IF;
END $$;

-- Create index for pinned attributes
CREATE INDEX IF NOT EXISTS idx_variant_attributes_pinned ON variant_attributes(variant_id, is_pinned) WHERE is_pinned = true;

-- Create index for numeric values
CREATE INDEX IF NOT EXISTS idx_variant_attributes_numeric ON variant_attributes(numeric_value) WHERE numeric_value IS NOT NULL;
