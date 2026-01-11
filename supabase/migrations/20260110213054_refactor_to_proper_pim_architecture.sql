/*
  # Refactor to Proper PIM Architecture

  ## Critical Changes

  This migration completely refactors the database to match PIM requirements:

  ### IDENTIFIERS (CRITICAL CHANGE)
  - Products and categories now use SERIAL (integer) IDs internally
  - Supplier identifiers are external references only
  - Matching logic: supplier + supplier_sku for products, supplier + supplier_category_ref for categories

  ### CATEGORIES (ONE-TO-ONE FROM SANDI)
  - Single `categories` table (removes separation of supplier_categories and internal_categories)
  - Each category stores:
    - id (serial) - internal_category_id
    - supplier (text) - always "sandi" at this stage
    - supplier_category_ref (text) - UUID from supplier
    - parent_id (integer) - reference to parent category
    - names in RU/UA
    - image, is_active, display_order

  ### PRODUCTS (ONE-TO-ONE FROM SANDI)
  - Products table with proper structure:
    - id (serial) - internal_product_id
    - supplier (text) - supplier identifier
    - supplier_sku (text) - external SKU from supplier
    - barcode, vendor_code, brand_ref
    - category_id (integer) - reference to categories.id
    - multilingual names, descriptions
    - attributes as JSONB {ru, uk}
    - images as JSONB array
    - stock tracking
    - quality metrics (is_ready, completeness_score)

  ### PRICES (MULTIPLE PRICE TYPES)
  - product_prices table supporting:
    - retail_rrp (from retail.current)
    - purchase_cash (from purchase.cash.current)
    - selling (manager-defined)
    - promo, discount (future)

  ### IMPORT LOGGING (ENHANCED)
  - Detailed import statistics
  - selected_categories tracking
  - error_details as JSONB
  - per-SKU logging

  ### WAREHOUSE STOCKS
  - Stock balances per warehouse per product

  ### DATA QUALITY
  - category_quality_templates per category
  - product_quality_scores per product
  - Automated quality calculations

  ## New Tables

  1. categories - Internal categories (one-to-one from SANDI)
  2. products - Products with internal IDs
  3. product_prices - Multiple price types per product
  4. warehouse_stocks - Stock by warehouse
  5. imports - Import runs with detailed stats
  6. import_logs - Per-SKU import logs
  7. brands - Brand management
  8. category_quality_templates - Quality requirements per category
  9. product_quality_scores - Quality metrics per product
  10. quality_change_logs - Audit trail
  11. import_diffs - Change tracking between imports

  ## Security
  - RLS enabled on all tables
  - Authenticated users can manage data
*/

-- Drop old tables
DROP TABLE IF EXISTS variant_quality_scores CASCADE;
DROP TABLE IF EXISTS category_quality_templates CASCADE;
DROP TABLE IF EXISTS quality_change_logs CASCADE;
DROP TABLE IF EXISTS import_snapshots CASCADE;
DROP TABLE IF EXISTS import_diffs CASCADE;
DROP TABLE IF EXISTS import_logs CASCADE;
DROP TABLE IF EXISTS variant_attributes CASCADE;
DROP TABLE IF EXISTS variant_prices CASCADE;
DROP TABLE IF EXISTS variant_images CASCADE;
DROP TABLE IF EXISTS warehouse_balances CASCADE;
DROP TABLE IF EXISTS variants CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS category_mappings CASCADE;
DROP TABLE IF EXISTS internal_categories CASCADE;
DROP TABLE IF EXISTS supplier_categories CASCADE;
DROP TABLE IF EXISTS brands CASCADE;
DROP TABLE IF EXISTS attributes CASCADE;
DROP TABLE IF EXISTS imports CASCADE;
DROP TABLE IF EXISTS currencies CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;

-- Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create categories table (internal categories - one-to-one from SANDI)
CREATE TABLE IF NOT EXISTS categories (
  id serial PRIMARY KEY,
  supplier text NOT NULL DEFAULT 'sandi',
  supplier_category_ref text NOT NULL,
  parent_id integer REFERENCES categories(id) ON DELETE SET NULL,
  name_ru text DEFAULT '',
  name_uk text DEFAULT '',
  image text DEFAULT '',
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(supplier, supplier_category_ref)
);

CREATE INDEX idx_categories_supplier ON categories(supplier);
CREATE INDEX idx_categories_supplier_ref ON categories(supplier_category_ref);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_is_active ON categories(is_active);

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

CREATE INDEX idx_brands_supplier_id ON brands(supplier_id);
CREATE INDEX idx_brands_external_ref ON brands(external_ref);

-- Create products table (internal products - one-to-one from SANDI)
CREATE TABLE IF NOT EXISTS products (
  id serial PRIMARY KEY,
  supplier text NOT NULL DEFAULT 'sandi',
  supplier_sku text NOT NULL,
  barcode text DEFAULT '',
  vendor_code text DEFAULT '',
  brand_ref text DEFAULT '',
  category_id integer REFERENCES categories(id) ON DELETE SET NULL,
  name_ru text DEFAULT '',
  name_uk text DEFAULT '',
  description_ru text DEFAULT '',
  description_uk text DEFAULT '',
  attributes_ru jsonb DEFAULT '{}'::jsonb,
  attributes_uk jsonb DEFAULT '{}'::jsonb,
  images jsonb DEFAULT '[]'::jsonb,
  main_image text DEFAULT '',
  total_stock integer DEFAULT 0,
  is_ready boolean DEFAULT false,
  completeness_score integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(supplier, supplier_sku)
);

CREATE INDEX idx_products_supplier ON products(supplier);
CREATE INDEX idx_products_supplier_sku ON products(supplier_sku);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_brand_ref ON products(brand_ref);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_is_ready ON products(is_ready);
CREATE INDEX idx_products_completeness_score ON products(completeness_score);

-- Create product_prices table (multiple price types)
CREATE TABLE IF NOT EXISTS product_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id integer REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  price_type text NOT NULL CHECK (price_type IN ('retail_rrp', 'purchase_cash', 'selling', 'promo', 'discount', 'contract')),
  value decimal(10, 2) NOT NULL DEFAULT 0,
  currency text DEFAULT 'UAH',
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_id, price_type)
);

CREATE INDEX idx_product_prices_product_id ON product_prices(product_id);
CREATE INDEX idx_product_prices_price_type ON product_prices(price_type);

-- Create warehouse_stocks table
CREATE TABLE IF NOT EXISTS warehouse_stocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id integer REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  warehouse_code text NOT NULL,
  warehouse_name text DEFAULT '',
  quantity integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_id, warehouse_code)
);

CREATE INDEX idx_warehouse_stocks_product_id ON warehouse_stocks(product_id);
CREATE INDEX idx_warehouse_stocks_warehouse_code ON warehouse_stocks(warehouse_code);

-- Create imports table (enhanced)
CREATE TABLE IF NOT EXISTS imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  filename text NOT NULL,
  selected_categories jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'pending',
  categories_created integer DEFAULT 0,
  categories_updated integer DEFAULT 0,
  products_created integer DEFAULT 0,
  products_updated integer DEFAULT 0,
  prices_updated integer DEFAULT 0,
  images_downloaded integer DEFAULT 0,
  stock_updated integer DEFAULT 0,
  errors_count integer DEFAULT 0,
  error_details jsonb DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_imports_supplier_id ON imports(supplier_id);
CREATE INDEX idx_imports_created_by ON imports(created_by);
CREATE INDEX idx_imports_status ON imports(status);
CREATE INDEX idx_imports_created_at ON imports(created_at DESC);

-- Create import_logs table (per-SKU logging)
CREATE TABLE IF NOT EXISTS import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid REFERENCES imports(id) ON DELETE CASCADE NOT NULL,
  supplier_sku text NOT NULL,
  action text NOT NULL CHECK (action IN ('created', 'updated', 'skipped', 'failed')),
  message text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_import_logs_import_id ON import_logs(import_id);
CREATE INDEX idx_import_logs_supplier_sku ON import_logs(supplier_sku);
CREATE INDEX idx_import_logs_action ON import_logs(action);

-- Create category_quality_templates table
CREATE TABLE IF NOT EXISTS category_quality_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id integer REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
  required_attributes jsonb DEFAULT '[]'::jsonb,
  minimum_image_count integer DEFAULT 1,
  selling_price_required boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(category_id)
);

CREATE INDEX idx_category_quality_templates_category_id ON category_quality_templates(category_id);

-- Create product_quality_scores table
CREATE TABLE IF NOT EXISTS product_quality_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id integer REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  completeness_score integer DEFAULT 0,
  not_ready_reasons jsonb DEFAULT '[]'::jsonb,
  has_selling_price boolean DEFAULT false,
  has_images boolean DEFAULT false,
  has_category boolean DEFAULT false,
  has_required_attributes boolean DEFAULT false,
  calculated_at timestamptz DEFAULT now(),
  UNIQUE(product_id)
);

CREATE INDEX idx_product_quality_scores_product_id ON product_quality_scores(product_id);
CREATE INDEX idx_product_quality_scores_score ON product_quality_scores(completeness_score);
CREATE INDEX idx_product_quality_scores_reasons ON product_quality_scores USING gin(not_ready_reasons);

-- Create quality_change_logs table (audit trail)
CREATE TABLE IF NOT EXISTS quality_change_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id integer REFERENCES products(id) ON DELETE CASCADE,
  change_type text NOT NULL,
  old_value text,
  new_value text,
  reason text NOT NULL,
  triggered_by text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_quality_change_logs_product_id ON quality_change_logs(product_id);
CREATE INDEX idx_quality_change_logs_created_at ON quality_change_logs(created_at DESC);

-- Create import_diffs table (change tracking)
CREATE TABLE IF NOT EXISTS import_diffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid REFERENCES imports(id) ON DELETE CASCADE NOT NULL,
  product_id integer REFERENCES products(id) ON DELETE CASCADE,
  supplier_sku text NOT NULL,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  change_type text NOT NULL CHECK (change_type IN ('added', 'modified', 'removed')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_import_diffs_import_id ON import_diffs(import_id);
CREATE INDEX idx_import_diffs_product_id ON import_diffs(product_id);
CREATE INDEX idx_import_diffs_supplier_sku ON import_diffs(supplier_sku);

-- Enable Row Level Security
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_quality_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_quality_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_change_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_diffs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for suppliers
CREATE POLICY "Authenticated users can view suppliers"
  ON suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert suppliers"
  ON suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update suppliers"
  ON suppliers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete suppliers"
  ON suppliers FOR DELETE TO authenticated USING (true);

-- Create RLS policies for categories
CREATE POLICY "Authenticated users can view categories"
  ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert categories"
  ON categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update categories"
  ON categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete categories"
  ON categories FOR DELETE TO authenticated USING (true);

-- Create RLS policies for brands
CREATE POLICY "Authenticated users can view brands"
  ON brands FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert brands"
  ON brands FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update brands"
  ON brands FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete brands"
  ON brands FOR DELETE TO authenticated USING (true);

-- Create RLS policies for products
CREATE POLICY "Authenticated users can view products"
  ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert products"
  ON products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update products"
  ON products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete products"
  ON products FOR DELETE TO authenticated USING (true);

-- Create RLS policies for product_prices
CREATE POLICY "Authenticated users can view product_prices"
  ON product_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert product_prices"
  ON product_prices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update product_prices"
  ON product_prices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete product_prices"
  ON product_prices FOR DELETE TO authenticated USING (true);

-- Create RLS policies for warehouse_stocks
CREATE POLICY "Authenticated users can view warehouse_stocks"
  ON warehouse_stocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert warehouse_stocks"
  ON warehouse_stocks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update warehouse_stocks"
  ON warehouse_stocks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete warehouse_stocks"
  ON warehouse_stocks FOR DELETE TO authenticated USING (true);

-- Create RLS policies for imports
CREATE POLICY "Authenticated users can view imports"
  ON imports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert imports"
  ON imports FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update imports"
  ON imports FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete imports"
  ON imports FOR DELETE TO authenticated USING (true);

-- Create RLS policies for import_logs
CREATE POLICY "Authenticated users can view import_logs"
  ON import_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert import_logs"
  ON import_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Create RLS policies for category_quality_templates
CREATE POLICY "Authenticated users can view category_quality_templates"
  ON category_quality_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert category_quality_templates"
  ON category_quality_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update category_quality_templates"
  ON category_quality_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete category_quality_templates"
  ON category_quality_templates FOR DELETE TO authenticated USING (true);

-- Create RLS policies for product_quality_scores
CREATE POLICY "Authenticated users can view product_quality_scores"
  ON product_quality_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert product_quality_scores"
  ON product_quality_scores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update product_quality_scores"
  ON product_quality_scores FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete product_quality_scores"
  ON product_quality_scores FOR DELETE TO authenticated USING (true);

-- Create RLS policies for quality_change_logs
CREATE POLICY "Authenticated users can view quality_change_logs"
  ON quality_change_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert quality_change_logs"
  ON quality_change_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Create RLS policies for import_diffs
CREATE POLICY "Authenticated users can view import_diffs"
  ON import_diffs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert import_diffs"
  ON import_diffs FOR INSERT TO authenticated WITH CHECK (true);

-- Create function to calculate product quality score
CREATE OR REPLACE FUNCTION calculate_product_quality(p_product_id integer)
RETURNS void AS $$
DECLARE
  v_product record;
  v_template record;
  v_score integer := 0;
  v_reasons jsonb := '[]'::jsonb;
  v_has_selling_price boolean := false;
  v_has_images boolean := false;
  v_has_category boolean := false;
  v_has_required_attributes boolean := true;
BEGIN
  SELECT * INTO v_product FROM products WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_product.category_id IS NOT NULL THEN
    v_has_category := true;
    v_score := v_score + 25;
  ELSE
    v_reasons := v_reasons || jsonb_build_object('code', 'no_category', 'message', 'Category not assigned');
  END IF;

  IF jsonb_array_length(v_product.images) > 0 THEN
    v_has_images := true;
    v_score := v_score + 25;
  ELSE
    v_reasons := v_reasons || jsonb_build_object('code', 'no_images', 'message', 'No product images');
  END IF;

  IF EXISTS (SELECT 1 FROM product_prices WHERE product_id = p_product_id AND price_type = 'selling' AND value > 0) THEN
    v_has_selling_price := true;
    v_score := v_score + 25;
  ELSE
    v_reasons := v_reasons || jsonb_build_object('code', 'no_selling_price', 'message', 'Selling price not set');
  END IF;

  IF v_has_category THEN
    SELECT * INTO v_template FROM category_quality_templates WHERE category_id = v_product.category_id;
    IF FOUND THEN
      IF jsonb_array_length(v_product.images) < v_template.minimum_image_count THEN
        v_reasons := v_reasons || jsonb_build_object(
          'code', 'insufficient_images',
          'message', format('Need at least %s images', v_template.minimum_image_count)
        );
        v_has_required_attributes := false;
      END IF;
    END IF;
  END IF;

  IF v_product.total_stock >= 0 THEN
    v_score := v_score + 25;
  ELSE
    v_reasons := v_reasons || jsonb_build_object('code', 'invalid_stock', 'message', 'Stock quantity is invalid');
  END IF;

  INSERT INTO product_quality_scores (
    product_id, completeness_score, not_ready_reasons,
    has_selling_price, has_images, has_category, has_required_attributes,
    calculated_at
  ) VALUES (
    p_product_id, v_score, v_reasons,
    v_has_selling_price, v_has_images, v_has_category, v_has_required_attributes,
    now()
  )
  ON CONFLICT (product_id) DO UPDATE SET
    completeness_score = EXCLUDED.completeness_score,
    not_ready_reasons = EXCLUDED.not_ready_reasons,
    has_selling_price = EXCLUDED.has_selling_price,
    has_images = EXCLUDED.has_images,
    has_category = EXCLUDED.has_category,
    has_required_attributes = EXCLUDED.has_required_attributes,
    calculated_at = EXCLUDED.calculated_at;

  UPDATE products SET
    is_ready = (v_score = 100),
    completeness_score = v_score
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-calculate quality on product changes
CREATE OR REPLACE FUNCTION trigger_calculate_product_quality()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM calculate_product_quality(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_quality_update
  AFTER INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION trigger_calculate_product_quality();

-- Create trigger for product_prices changes
CREATE OR REPLACE FUNCTION trigger_calculate_quality_on_price_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM calculate_product_quality(NEW.product_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_prices_quality_update
  AFTER INSERT OR UPDATE OR DELETE ON product_prices
  FOR EACH ROW
  EXECUTE FUNCTION trigger_calculate_quality_on_price_change();

-- Insert default SANDI supplier
INSERT INTO suppliers (id, name, code, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'SANDI',
  'sandi',
  now()
) ON CONFLICT (code) DO NOTHING;
