/*
  # Add Variant Prices Table for Multiple Price Points

  ## Overview
  This migration creates a flexible pricing system where each variant (SKU) can have multiple prices
  with different types (RRP, wholesale, dealer, promo, supplier) from different sources.

  ## New Tables

  ### variant_prices
  - `id` (uuid, primary key) - Unique identifier
  - `variant_id` (uuid, foreign key) - References variants table
  - `price_type` (text) - Type of price: RRP, wholesale, dealer, promo, supplier
  - `value` (decimal) - Price value
  - `currency_id` (uuid, foreign key) - References currencies table
  - `source` (text) - Source of the price (e.g., 'supplier', 'manual', 'calculated')
  - `created_at` (timestamptz) - Timestamp of creation
  - `updated_at` (timestamptz) - Timestamp of last update

  ## Changes
  - Keep existing `price` field in variants table for backward compatibility
  - New variant_prices table allows multiple prices per variant
  - Each price has a type and source for tracking

  ## Security
  - Enable RLS on variant_prices table
  - Authenticated users can manage all price data
*/

-- Create variant_prices table
CREATE TABLE IF NOT EXISTS variant_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid REFERENCES variants(id) ON DELETE CASCADE NOT NULL,
  price_type text NOT NULL CHECK (price_type IN ('RRP', 'wholesale', 'dealer', 'promo', 'supplier')),
  value decimal(10, 2) NOT NULL DEFAULT 0,
  currency_id uuid REFERENCES currencies(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_variant_prices_variant_id ON variant_prices(variant_id);
CREATE INDEX IF NOT EXISTS idx_variant_prices_price_type ON variant_prices(price_type);
CREATE INDEX IF NOT EXISTS idx_variant_prices_currency_id ON variant_prices(currency_id);

-- Enable Row Level Security
ALTER TABLE variant_prices ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for variant_prices
CREATE POLICY "Authenticated users can view variant_prices"
  ON variant_prices FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert variant_prices"
  ON variant_prices FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update variant_prices"
  ON variant_prices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete variant_prices"
  ON variant_prices FOR DELETE TO authenticated USING (true);
