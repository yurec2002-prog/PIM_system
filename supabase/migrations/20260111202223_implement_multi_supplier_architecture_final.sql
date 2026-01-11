/*
  # Implement Multi-Supplier Architecture (Final)

  ## Overview
  Transform the PIM system to support multiple suppliers while maintaining
  SKU logic, readiness rules, and export functionality.

  ## Tables Created/Modified
  1. suppliers - Enhanced with data_format, status, config
  2. supplier_products - New table (supplier-specific products)
  3. internal_skus - Master product catalog
  4. sku_links - Links internal to supplier SKUs
  5. Updated: warehouse_stocks, product_prices, etc.
*/

-- ==========================================
-- 1. ENHANCE SUPPLIERS TABLE
-- ==========================================

-- Add missing columns to suppliers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'suppliers' AND column_name = 'data_format'
  ) THEN
    ALTER TABLE suppliers ADD COLUMN data_format text NOT NULL DEFAULT 'JSON' CHECK (data_format IN ('JSON', 'XML', 'YML', 'XLS', 'CSV'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'suppliers' AND column_name = 'status'
  ) THEN
    ALTER TABLE suppliers ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'suppliers' AND column_name = 'config'
  ) THEN
    ALTER TABLE suppliers ADD COLUMN config jsonb DEFAULT '{}';
  END IF;
END $$;

-- Update existing Sandi supplier
UPDATE suppliers 
SET 
  name = 'Sandi',
  data_format = 'JSON',
  status = 'active',
  config = '{}'::jsonb
WHERE code = 'sandi';

-- ==========================================
-- 2. INTERNAL SKUS (MASTER PRODUCTS)
-- ==========================================

CREATE TABLE IF NOT EXISTS internal_skus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_sku text NOT NULL UNIQUE, -- Auto-generated (e.g., VOD00000001)
  
  -- Core product data (unified from suppliers)
  name_ru text,
  name_uk text,
  description_ru text,
  description_uk text,
  
  -- Master catalog organization
  internal_category_id uuid REFERENCES internal_categories(id),
  brand_ref text,
  
  -- Unified attributes
  attributes jsonb DEFAULT '{}',
  
  -- Identifiers
  barcode text,
  vendor_code text,
  
  -- Media
  images jsonb DEFAULT '[]',
  
  -- Aggregated data
  total_stock integer DEFAULT 0,
  min_retail_price numeric(10, 2),
  max_retail_price numeric(10, 2),
  min_purchase_price numeric(10, 2),
  
  -- Preferred supplier for this SKU
  preferred_supplier_id uuid REFERENCES suppliers(id),
  
  -- Readiness (calculated from linked supplier SKUs)
  is_ready boolean DEFAULT false,
  blocking_reasons text[] DEFAULT '{}',
  blocking_reasons_text jsonb DEFAULT '{}',
  warnings text[] DEFAULT '{}',
  warnings_text jsonb DEFAULT '{}',
  
  -- Quality score (aggregated)
  quality_score integer DEFAULT 0,
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE internal_skus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read internal_skus"
  ON internal_skus FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage internal_skus"
  ON internal_skus FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_internal_skus_category ON internal_skus(internal_category_id);
CREATE INDEX IF NOT EXISTS idx_internal_skus_brand ON internal_skus(brand_ref);
CREATE INDEX IF NOT EXISTS idx_internal_skus_barcode ON internal_skus(barcode);
CREATE INDEX IF NOT EXISTS idx_internal_skus_vendor_code ON internal_skus(vendor_code);
CREATE INDEX IF NOT EXISTS idx_internal_skus_ready ON internal_skus(is_ready);
CREATE INDEX IF NOT EXISTS idx_internal_skus_preferred_supplier ON internal_skus(preferred_supplier_id);

-- ==========================================
-- 3. SUPPLIER PRODUCTS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS supplier_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_sku text NOT NULL, -- External SKU from supplier
  
  -- Supplier category
  supplier_category_id uuid REFERENCES supplier_categories(id),
  
  -- Product data (as provided by supplier)
  name_ru text,
  name_uk text,
  description_ru text,
  description_uk text,
  
  -- Internal categorization (synced from mapping)
  internal_category_id uuid REFERENCES internal_categories(id),
  brand_ref text,
  
  -- Attributes from supplier
  attributes jsonb DEFAULT '{}',
  
  -- Identifiers
  barcode text,
  vendor_code text,
  
  -- Media from supplier
  images jsonb DEFAULT '[]',
  
  -- Stock (aggregated from warehouses)
  total_stock integer DEFAULT 0,
  
  -- Raw supplier data (for debugging)
  raw_data jsonb DEFAULT '{}',
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(supplier_id, supplier_sku)
);

ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read supplier_products"
  ON supplier_products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage supplier_products"
  ON supplier_products FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier ON supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_sku ON supplier_products(supplier_sku);
CREATE INDEX IF NOT EXISTS idx_supplier_products_category ON supplier_products(supplier_category_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_internal_cat ON supplier_products(internal_category_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_barcode ON supplier_products(barcode);
CREATE INDEX IF NOT EXISTS idx_supplier_products_vendor_code ON supplier_products(vendor_code);

-- ==========================================
-- 4. SKU LINKS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS sku_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_sku_id uuid NOT NULL REFERENCES internal_skus(id) ON DELETE CASCADE,
  supplier_product_id uuid NOT NULL REFERENCES supplier_products(id) ON DELETE CASCADE,
  
  -- Link metadata
  link_type text DEFAULT 'manual' CHECK (link_type IN ('manual', 'auto_barcode', 'auto_vendor_code', 'auto_attributes')),
  link_confidence numeric(3, 2) DEFAULT 1.0 CHECK (link_confidence >= 0 AND link_confidence <= 1.0),
  
  -- Is this the primary source for the internal SKU?
  is_primary boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  
  UNIQUE(internal_sku_id, supplier_product_id)
);

ALTER TABLE sku_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read sku_links"
  ON sku_links FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage sku_links"
  ON sku_links FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sku_links_internal ON sku_links(internal_sku_id);
CREATE INDEX IF NOT EXISTS idx_sku_links_supplier ON sku_links(supplier_product_id);
CREATE INDEX IF NOT EXISTS idx_sku_links_primary ON sku_links(is_primary) WHERE is_primary = true;

-- ==========================================
-- 5. UPDATE RELATED TABLES
-- ==========================================

-- Add supplier_product_id to warehouse_stocks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'warehouse_stocks' AND column_name = 'supplier_product_id'
  ) THEN
    ALTER TABLE warehouse_stocks ADD COLUMN supplier_product_id uuid REFERENCES supplier_products(id) ON DELETE CASCADE;
    CREATE INDEX idx_warehouse_stocks_supplier_product ON warehouse_stocks(supplier_product_id);
  END IF;
END $$;

-- Add supplier_product_id to product_prices (not variant_prices)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_prices' AND column_name = 'supplier_product_id'
  ) THEN
    ALTER TABLE product_prices ADD COLUMN supplier_product_id uuid REFERENCES supplier_products(id) ON DELETE CASCADE;
    CREATE INDEX idx_product_prices_supplier_product ON product_prices(supplier_product_id);
  END IF;
END $$;

-- Add supplier_id to supplier_categories (already done, but check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'supplier_categories' AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE supplier_categories ADD COLUMN supplier_id uuid REFERENCES suppliers(id) ON DELETE CASCADE;
    CREATE INDEX idx_supplier_categories_supplier ON supplier_categories(supplier_id);
  END IF;
END $$;

-- Update all existing supplier_categories to belong to Sandi
UPDATE supplier_categories 
SET supplier_id = (SELECT id FROM suppliers WHERE code = 'sandi')
WHERE supplier_id IS NULL;

-- Add supplier_id to brands (already done, but check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'brands' AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE brands ADD COLUMN supplier_id uuid REFERENCES suppliers(id);
    CREATE INDEX idx_brands_supplier ON brands(supplier_id);
  END IF;
END $$;

-- Update all existing brands to belong to Sandi
UPDATE brands 
SET supplier_id = (SELECT id FROM suppliers WHERE code = 'sandi')
WHERE supplier_id IS NULL;

-- ==========================================
-- 6. COMMENTS
-- ==========================================

COMMENT ON TABLE suppliers IS 'Registry of all product suppliers (Sandi, future suppliers)';
COMMENT ON TABLE internal_skus IS 'Master product catalog - unified SKUs independent of supplier';
COMMENT ON TABLE supplier_products IS 'Raw products from each supplier - isolated data';
COMMENT ON TABLE sku_links IS 'Links between internal SKUs and supplier products - explicit relationships';
COMMENT ON COLUMN internal_skus.preferred_supplier_id IS 'Preferred supplier for price/stock when multiple suppliers linked';
COMMENT ON COLUMN sku_links.is_primary IS 'Primary link used for data aggregation to internal SKU';
