/*
  # Create PIM System for Supplier Feed Management

  ## Overview
  This migration creates a comprehensive PIM system for importing supplier YML feeds
  and exporting to Bitrix.

  ## New Tables

  ### 1. suppliers
  - `id` (uuid, primary key)
  - `name` (text, supplier name)
  - `created_at` (timestamptz)

  ### 2. supplier_categories
  - `id` (uuid, primary key)
  - `supplier_id` (uuid, reference to suppliers)
  - `external_id` (text, category id from YML)
  - `name` (text, category name)
  - `parent_id` (uuid, for hierarchical categories)
  - `created_at` (timestamptz)

  ### 3. internal_categories
  - `id` (uuid, primary key)
  - `name` (text, internal category name)
  - `slug` (text, url-friendly identifier)
  - `parent_id` (uuid, for hierarchy)
  - `created_at` (timestamptz)

  ### 4. category_mappings
  - `id` (uuid, primary key)
  - `supplier_category_id` (uuid, reference to supplier_categories)
  - `internal_category_id` (uuid, reference to internal_categories)
  - `created_at` (timestamptz)

  ### 5. currencies
  - `id` (uuid, primary key)
  - `code` (text, currency code like UAH, USD)
  - `rate` (decimal, exchange rate)
  - `created_at` (timestamptz)

  ### 6. products
  - `id` (uuid, primary key)
  - `supplier_id` (uuid, reference to suppliers)
  - `vendor` (text, brand)
  - `model` (text, model name)
  - `name` (text, product name)
  - `description` (text, product description)
  - `name_ua` (text, Ukrainian name)
  - `description_ua` (text, Ukrainian description)
  - `internal_category_id` (uuid, mapped category)
  - `is_ready` (boolean, data quality flag)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 7. variants (SKUs)
  - `id` (uuid, primary key)
  - `product_id` (uuid, reference to products)
  - `external_id` (text, offer id from YML)
  - `sku` (text, internal SKU)
  - `price` (decimal, price)
  - `currency_id` (uuid, reference to currencies)
  - `stock_quantity` (integer, stock)
  - `available` (boolean, availability flag)
  - `supplier_category_id` (uuid, reference to supplier_categories)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 8. variant_images
  - `id` (uuid, primary key)
  - `variant_id` (uuid, reference to variants)
  - `url` (text, image URL)
  - `position` (integer, sort order)
  - `created_at` (timestamptz)

  ### 9. attributes
  - `id` (uuid, primary key)
  - `name` (text, attribute name)
  - `created_at` (timestamptz)

  ### 10. variant_attributes
  - `id` (uuid, primary key)
  - `variant_id` (uuid, reference to variants)
  - `attribute_id` (uuid, reference to attributes)
  - `value` (text, attribute value)
  - `created_at` (timestamptz)

  ### 11. imports
  - `id` (uuid, primary key)
  - `supplier_id` (uuid, reference to suppliers)
  - `filename` (text, uploaded file name)
  - `status` (text, processing status)
  - `products_count` (integer, number of products imported)
  - `variants_count` (integer, number of variants imported)
  - `error_message` (text, error details if failed)
  - `created_by` (uuid, reference to auth.users)
  - `created_at` (timestamptz)
  - `completed_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Authenticated users can manage all data
*/

-- Drop existing tables if they exist
DROP TABLE IF EXISTS product_attributes CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS attributes CASCADE;

-- Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create supplier_categories table
CREATE TABLE IF NOT EXISTS supplier_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES suppliers(id) ON DELETE CASCADE NOT NULL,
  external_id text NOT NULL,
  name text NOT NULL,
  parent_id uuid REFERENCES supplier_categories(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(supplier_id, external_id)
);

-- Create internal_categories table
CREATE TABLE IF NOT EXISTS internal_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  parent_id uuid REFERENCES internal_categories(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create category_mappings table
CREATE TABLE IF NOT EXISTS category_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_category_id uuid REFERENCES supplier_categories(id) ON DELETE CASCADE NOT NULL,
  internal_category_id uuid REFERENCES internal_categories(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(supplier_category_id)
);

-- Create currencies table
CREATE TABLE IF NOT EXISTS currencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  rate decimal(10, 4) DEFAULT 1.0,
  created_at timestamptz DEFAULT now()
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES suppliers(id) ON DELETE CASCADE NOT NULL,
  vendor text NOT NULL,
  model text DEFAULT '',
  name text NOT NULL,
  description text DEFAULT '',
  name_ua text DEFAULT '',
  description_ua text DEFAULT '',
  internal_category_id uuid REFERENCES internal_categories(id) ON DELETE SET NULL,
  is_ready boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create variants table
CREATE TABLE IF NOT EXISTS variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  external_id text NOT NULL,
  sku text DEFAULT '',
  price decimal(10, 2) DEFAULT 0,
  currency_id uuid REFERENCES currencies(id) ON DELETE SET NULL,
  stock_quantity integer DEFAULT 0,
  available boolean DEFAULT true,
  supplier_category_id uuid REFERENCES supplier_categories(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_id, external_id)
);

-- Create variant_images table
CREATE TABLE IF NOT EXISTS variant_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid REFERENCES variants(id) ON DELETE CASCADE NOT NULL,
  url text NOT NULL,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create attributes table
CREATE TABLE IF NOT EXISTS attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create variant_attributes table
CREATE TABLE IF NOT EXISTS variant_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid REFERENCES variants(id) ON DELETE CASCADE NOT NULL,
  attribute_id uuid REFERENCES attributes(id) ON DELETE CASCADE NOT NULL,
  value text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(variant_id, attribute_id)
);

-- Create imports table
CREATE TABLE IF NOT EXISTS imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES suppliers(id) ON DELETE CASCADE NOT NULL,
  filename text NOT NULL,
  status text DEFAULT 'pending',
  products_count integer DEFAULT 0,
  variants_count integer DEFAULT 0,
  error_message text DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_supplier_categories_supplier_id ON supplier_categories(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_categories_parent_id ON supplier_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_internal_categories_parent_id ON internal_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_category_mappings_supplier_category_id ON category_mappings(supplier_category_id);
CREATE INDEX IF NOT EXISTS idx_category_mappings_internal_category_id ON category_mappings(internal_category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_internal_category_id ON products(internal_category_id);
CREATE INDEX IF NOT EXISTS idx_products_vendor_model ON products(vendor, model);
CREATE INDEX IF NOT EXISTS idx_variants_product_id ON variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_external_id ON variants(external_id);
CREATE INDEX IF NOT EXISTS idx_variant_images_variant_id ON variant_images(variant_id);
CREATE INDEX IF NOT EXISTS idx_variant_attributes_variant_id ON variant_attributes(variant_id);
CREATE INDEX IF NOT EXISTS idx_variant_attributes_attribute_id ON variant_attributes(attribute_id);
CREATE INDEX IF NOT EXISTS idx_imports_supplier_id ON imports(supplier_id);
CREATE INDEX IF NOT EXISTS idx_imports_created_by ON imports(created_by);

-- Enable Row Level Security
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE imports ENABLE ROW LEVEL SECURITY;

-- Create policies for all tables (authenticated users can manage all data)
CREATE POLICY "Authenticated users can view suppliers"
  ON suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert suppliers"
  ON suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update suppliers"
  ON suppliers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete suppliers"
  ON suppliers FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view supplier_categories"
  ON supplier_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert supplier_categories"
  ON supplier_categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update supplier_categories"
  ON supplier_categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete supplier_categories"
  ON supplier_categories FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view internal_categories"
  ON internal_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert internal_categories"
  ON internal_categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update internal_categories"
  ON internal_categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete internal_categories"
  ON internal_categories FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view category_mappings"
  ON category_mappings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert category_mappings"
  ON category_mappings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update category_mappings"
  ON category_mappings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete category_mappings"
  ON category_mappings FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view currencies"
  ON currencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert currencies"
  ON currencies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update currencies"
  ON currencies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete currencies"
  ON currencies FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view products"
  ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert products"
  ON products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update products"
  ON products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete products"
  ON products FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view variants"
  ON variants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert variants"
  ON variants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update variants"
  ON variants FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete variants"
  ON variants FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view variant_images"
  ON variant_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert variant_images"
  ON variant_images FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update variant_images"
  ON variant_images FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete variant_images"
  ON variant_images FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view attributes"
  ON attributes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert attributes"
  ON attributes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update attributes"
  ON attributes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete attributes"
  ON attributes FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view variant_attributes"
  ON variant_attributes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert variant_attributes"
  ON variant_attributes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update variant_attributes"
  ON variant_attributes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete variant_attributes"
  ON variant_attributes FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view imports"
  ON imports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert imports"
  ON imports FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated users can update imports"
  ON imports FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete imports"
  ON imports FOR DELETE TO authenticated USING (true);