/*
  # Add Warehouses Table

  ## Overview
  This migration adds a dedicated warehouses table to store warehouse information
  from the Sandi JSON warehouses dictionary, and updates warehouse_balances to reference it.

  ## New Tables

  ### warehouses
  - `id` (uuid, primary key)
  - `supplier_id` (uuid, foreign key to suppliers)
  - `code` (text, warehouse code/reference)
  - `name` (text, warehouse name)
  - `name_ru` (text, Russian warehouse name)
  - `name_uk` (text, Ukrainian warehouse name)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Changes

  ### warehouse_balances
  - Add `warehouse_id` (uuid, foreign key to warehouses) - nullable for backward compatibility
  - Keep existing `warehouse_code` and `warehouse_name` fields for legacy data

  ## Security
  - Enable RLS on warehouses table
  - Authenticated users can manage all warehouse data
*/

-- Create warehouses table
CREATE TABLE IF NOT EXISTS warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES suppliers(id) ON DELETE CASCADE NOT NULL,
  code text NOT NULL,
  name text DEFAULT '',
  name_ru text DEFAULT '',
  name_uk text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(supplier_id, code)
);

-- Add warehouse_id to warehouse_balances
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_balances' AND column_name = 'warehouse_id'
  ) THEN
    ALTER TABLE warehouse_balances ADD COLUMN warehouse_id uuid REFERENCES warehouses(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_warehouses_supplier_id ON warehouses(supplier_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_code ON warehouses(code);
CREATE INDEX IF NOT EXISTS idx_warehouse_balances_warehouse_id ON warehouse_balances(warehouse_id);

-- Enable Row Level Security
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for warehouses
CREATE POLICY "Authenticated users can view warehouses"
  ON warehouses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert warehouses"
  ON warehouses FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update warehouses"
  ON warehouses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete warehouses"
  ON warehouses FOR DELETE TO authenticated USING (true);