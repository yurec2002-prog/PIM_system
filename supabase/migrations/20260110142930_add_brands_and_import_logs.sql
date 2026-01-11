/*
  # Add Brands Table and Enhanced Import Logging

  ## Overview
  This migration adds proper brand management and detailed import logging to support
  SKU-based UPSERT operations and comprehensive import tracking.

  ## New Tables

  1. **brands**
    - `id` (uuid, primary key)
    - `supplier_id` (uuid, reference to suppliers)
    - `external_ref` (text) - Brand reference from supplier
    - `name` (text) - Brand display name
    - `logo_url` (text) - Brand logo image
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)
    - UNIQUE constraint on (supplier_id, external_ref)

  2. **import_logs**
    - `id` (uuid, primary key)
    - `import_id` (uuid, reference to imports)
    - `sku` (text) - Product SKU
    - `action` (text) - created/updated/skipped/failed
    - `message` (text) - Details or error message
    - `created_at` (timestamptz)

  ## Table Updates

  1. **variants**
    - Add `barcode` (text) - Product barcode/EAN
    - Add `vendor_code` (text) - Supplier's internal code
    - Add `brand_id` (uuid, reference to brands)
    - Add index on SKU for faster lookups

  2. **imports**
    - Add detailed counters for tracking

  3. **warehouse_balances**
    - Add `warehouse_id` if not exists

  ## Security
  - Enable RLS on new tables
  - Authenticated users can manage all data
*/

-- Create brands table
CREATE TABLE IF NOT EXISTS brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES suppliers(id) ON DELETE CASCADE NOT NULL,
  external_ref text NOT NULL,
  name text NOT NULL,
  logo_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(supplier_id, external_ref)
);

CREATE INDEX IF NOT EXISTS idx_brands_supplier_id ON brands(supplier_id);
CREATE INDEX IF NOT EXISTS idx_brands_external_ref ON brands(external_ref);

-- Create import_logs table for detailed per-SKU logging
CREATE TABLE IF NOT EXISTS import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid REFERENCES imports(id) ON DELETE CASCADE NOT NULL,
  sku text NOT NULL,
  action text NOT NULL,
  message text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_logs_import_id ON import_logs(import_id);
CREATE INDEX IF NOT EXISTS idx_import_logs_sku ON import_logs(sku);
CREATE INDEX IF NOT EXISTS idx_import_logs_action ON import_logs(action);

-- Add new fields to variants table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'variants' AND column_name = 'barcode'
  ) THEN
    ALTER TABLE variants ADD COLUMN barcode text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'variants' AND column_name = 'vendor_code'
  ) THEN
    ALTER TABLE variants ADD COLUMN vendor_code text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'variants' AND column_name = 'brand_id'
  ) THEN
    ALTER TABLE variants ADD COLUMN brand_id uuid REFERENCES brands(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index on SKU for faster lookups
CREATE INDEX IF NOT EXISTS idx_variants_sku ON variants(sku);

-- Add detailed counters to imports table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'imports' AND column_name = 'products_created'
  ) THEN
    ALTER TABLE imports ADD COLUMN products_created integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'imports' AND column_name = 'products_updated'
  ) THEN
    ALTER TABLE imports ADD COLUMN products_updated integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'imports' AND column_name = 'products_skipped'
  ) THEN
    ALTER TABLE imports ADD COLUMN products_skipped integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'imports' AND column_name = 'categories_created'
  ) THEN
    ALTER TABLE imports ADD COLUMN categories_created integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'imports' AND column_name = 'categories_updated'
  ) THEN
    ALTER TABLE imports ADD COLUMN categories_updated integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'imports' AND column_name = 'brands_created'
  ) THEN
    ALTER TABLE imports ADD COLUMN brands_created integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'imports' AND column_name = 'brands_updated'
  ) THEN
    ALTER TABLE imports ADD COLUMN brands_updated integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'imports' AND column_name = 'prices_updated'
  ) THEN
    ALTER TABLE imports ADD COLUMN prices_updated integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'imports' AND column_name = 'images_added'
  ) THEN
    ALTER TABLE imports ADD COLUMN images_added integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'imports' AND column_name = 'images_skipped'
  ) THEN
    ALTER TABLE imports ADD COLUMN images_skipped integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'imports' AND column_name = 'stock_updated'
  ) THEN
    ALTER TABLE imports ADD COLUMN stock_updated integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'imports' AND column_name = 'errors_count'
  ) THEN
    ALTER TABLE imports ADD COLUMN errors_count integer DEFAULT 0;
  END IF;
END $$;

-- Add warehouse_id to warehouse_balances if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_balances' AND column_name = 'warehouse_id'
  ) THEN
    ALTER TABLE warehouse_balances ADD COLUMN warehouse_id uuid REFERENCES warehouses(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for brands
CREATE POLICY "Authenticated users can view brands"
  ON brands FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert brands"
  ON brands FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update brands"
  ON brands FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete brands"
  ON brands FOR DELETE TO authenticated USING (true);

-- Create RLS policies for import_logs
CREATE POLICY "Authenticated users can view import_logs"
  ON import_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert import_logs"
  ON import_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update import_logs"
  ON import_logs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete import_logs"
  ON import_logs FOR DELETE TO authenticated USING (true);
