/*
  # Add selected categories tracking to imports
  
  1. Changes
    - Add `selected_categories` field to track which supplier categories were selected for import
    - This helps display meaningful summary in import history
  
  2. Notes
    - Stores array of supplier category IDs that were selected
    - Nullable for backward compatibility with existing imports
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'imports' AND column_name = 'selected_categories'
  ) THEN
    ALTER TABLE imports ADD COLUMN selected_categories jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;