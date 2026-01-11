/*
  # Add description field to internal_categories

  1. Changes
    - Add `description` column to `internal_categories` table
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'internal_categories' AND column_name = 'description'
  ) THEN
    ALTER TABLE internal_categories ADD COLUMN description text DEFAULT '';
  END IF;
END $$;
