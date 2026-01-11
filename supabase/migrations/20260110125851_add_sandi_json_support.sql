/*
  # Add Sandi JSON Support

  ## Overview
  This migration adds support for importing Sandi JSON feeds with Russian/Ukrainian names
  and warehouse-specific stock balances.

  ## Changes

  1. **Products Table**
    - Add `name_ru` (text) - Russian product name
    - Add `description_ru` (text) - Russian description
    - Rename existing name/description fields for clarity
    
  2. **Warehouse Balances Table** (new)
    - `id` (uuid, primary key)
    - `variant_id` (uuid, foreign key to variants)
    - `warehouse_code` (text) - Warehouse identifier
    - `warehouse_name` (text) - Warehouse name
    - `quantity` (integer) - Stock quantity at this warehouse
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  3. **Variants Table**
    - Add `brand` (text) - Product brand reference

  ## Security
  - Enable RLS on warehouse_balances table
  - Authenticated users can manage all warehouse data
*/

-- Add Russian language fields to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'name_ru'
  ) THEN
    ALTER TABLE products ADD COLUMN name_ru text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'description_ru'
  ) THEN
    ALTER TABLE products ADD COLUMN description_ru text DEFAULT '';
  END IF;
END $$;

-- Add brand field to variants table for easier brand reference
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'variants' AND column_name = 'brand'
  ) THEN
    ALTER TABLE variants ADD COLUMN brand text DEFAULT '';
  END IF;
END $$;

-- Create warehouse_balances table
CREATE TABLE IF NOT EXISTS warehouse_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid REFERENCES variants(id) ON DELETE CASCADE NOT NULL,
  warehouse_code text NOT NULL,
  warehouse_name text DEFAULT '',
  quantity integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(variant_id, warehouse_code)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_warehouse_balances_variant_id ON warehouse_balances(variant_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_balances_warehouse_code ON warehouse_balances(warehouse_code);

-- Enable Row Level Security
ALTER TABLE warehouse_balances ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for warehouse_balances
CREATE POLICY "Authenticated users can view warehouse_balances"
  ON warehouse_balances FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert warehouse_balances"
  ON warehouse_balances FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update warehouse_balances"
  ON warehouse_balances FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete warehouse_balances"
  ON warehouse_balances FOR DELETE TO authenticated USING (true);
