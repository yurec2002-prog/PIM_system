/*
  # Fix category_quality_templates.category_id type

  1. Changes
    - Change category_id from integer to uuid
    - This fixes the JOIN with category_mappings.internal_category_id
*/

-- Drop the foreign key constraint first if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'category_quality_templates_category_id_fkey'
  ) THEN
    ALTER TABLE category_quality_templates DROP CONSTRAINT category_quality_templates_category_id_fkey;
  END IF;
END $$;

-- Change the column type from integer to uuid
ALTER TABLE category_quality_templates 
ALTER COLUMN category_id TYPE uuid USING category_id::text::uuid;