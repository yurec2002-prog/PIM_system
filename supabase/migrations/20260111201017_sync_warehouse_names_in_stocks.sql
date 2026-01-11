/*
  # Sync warehouse names in warehouse_stocks table

  ## Problem
  The warehouse_stocks table has warehouse_name field that is empty,
  causing the UI to display warehouse codes (UUIDs) instead of readable names.

  ## Solution
  1. Update all existing warehouse_stocks to populate warehouse_name from warehouses table
  2. Create trigger to auto-populate warehouse_name on insert/update

  ## Changes
  - Bulk update: sync warehouse_name for all existing records
  - New trigger: auto-populate warehouse_name from warehouses table
*/

-- Function to sync warehouse name
CREATE OR REPLACE FUNCTION sync_warehouse_stock_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Get the warehouse name from warehouses table
  SELECT w.name
  INTO NEW.warehouse_name
  FROM warehouses w
  WHERE w.code = NEW.warehouse_code;
  
  -- If not found, keep the code as fallback
  IF NEW.warehouse_name IS NULL OR NEW.warehouse_name = '' THEN
    NEW.warehouse_name := NEW.warehouse_code;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS sync_warehouse_name_trigger ON warehouse_stocks;

-- Create trigger to sync warehouse name on insert/update
CREATE TRIGGER sync_warehouse_name_trigger
  BEFORE INSERT OR UPDATE OF warehouse_code ON warehouse_stocks
  FOR EACH ROW
  EXECUTE FUNCTION sync_warehouse_stock_name();

-- Update all existing warehouse_stocks with proper names
UPDATE warehouse_stocks ws
SET warehouse_name = w.name
FROM warehouses w
WHERE w.code = ws.warehouse_code
  AND (ws.warehouse_name IS NULL OR ws.warehouse_name = '');
