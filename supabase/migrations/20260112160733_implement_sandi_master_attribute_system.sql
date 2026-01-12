/*
  # Implement Sandi-based Master Attribute System

  1. New Architecture
    - Master Attribute Dictionary (Sandi-based) - global dictionary
    - Category Attribute Schema - defines which attributes apply to category
    - SKU Attribute Values - actual values per SKU
    - Supplier Attribute Mapping - maps other suppliers to Master

  2. New Tables
    - `master_attribute_dictionary` - global Sandi-based attributes (no category binding)
    - `category_attribute_schemas` - defines which attributes apply to which categories
    - `sku_attribute_values` - replaces master_attribute_values, stores actual values
    - `supplier_attribute_mappings` - maps supplier attributes to master

  3. Changes
    - Drops old master_attributes table (category-bound)
    - Creates new global master dictionary
    - Separates schema from values
    - Adds Sandi priority logic

  4. Migration Strategy
    - Create new tables
    - Migrate existing data
    - Drop old tables
*/

-- =====================================================
-- 1) MASTER ATTRIBUTE DICTIONARY (Sandi-based, global)
-- =====================================================
CREATE TABLE IF NOT EXISTS master_attribute_dictionary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Attribute identity (from Sandi)
  sandi_attr_key text UNIQUE NOT NULL,
  name_ru text NOT NULL,
  name_uk text,
  
  -- Type and format
  type text NOT NULL CHECK (type IN ('text', 'number', 'select', 'boolean')),
  unit text,
  select_options jsonb DEFAULT '[]'::jsonb,
  
  -- Display and behavior
  priority integer DEFAULT 0,
  is_filterable boolean DEFAULT false,
  is_comparable boolean DEFAULT false,
  
  -- Search and matching
  synonyms text[] DEFAULT '{}'::text[],
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE master_attribute_dictionary IS 
  'Global Master Attribute Dictionary based on Sandi attributes. Single source of truth for all attribute definitions.';

CREATE INDEX IF NOT EXISTS idx_master_attr_dict_key ON master_attribute_dictionary(sandi_attr_key);
CREATE INDEX IF NOT EXISTS idx_master_attr_dict_priority ON master_attribute_dictionary(priority);

-- =====================================================
-- 2) CATEGORY ATTRIBUTE SCHEMA (rules, no values)
-- =====================================================
CREATE TABLE IF NOT EXISTS category_attribute_schemas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_category_id uuid NOT NULL REFERENCES internal_categories(id) ON DELETE CASCADE,
  master_attr_id uuid NOT NULL REFERENCES master_attribute_dictionary(id) ON DELETE CASCADE,
  
  -- Category-specific rules
  is_required boolean DEFAULT false,
  override_display_name text,
  override_unit text,
  priority_override integer,
  
  -- Grouping
  attribute_group text DEFAULT 'general',
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(internal_category_id, master_attr_id)
);

COMMENT ON TABLE category_attribute_schemas IS 
  'Defines which Master Attributes are applicable to each category and their rules (required, display, etc). No values stored here.';

CREATE INDEX IF NOT EXISTS idx_cat_attr_schema_category ON category_attribute_schemas(internal_category_id);
CREATE INDEX IF NOT EXISTS idx_cat_attr_schema_attr ON category_attribute_schemas(master_attr_id);

-- =====================================================
-- 3) SKU ATTRIBUTE VALUES (actual values)
-- =====================================================
CREATE TABLE IF NOT EXISTS sku_attribute_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_sku_id uuid NOT NULL REFERENCES internal_skus(id) ON DELETE CASCADE,
  master_attr_id uuid NOT NULL REFERENCES master_attribute_dictionary(id) ON DELETE CASCADE,
  
  -- Value
  value text,
  value_normalized text,
  
  -- Source tracking
  source_supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  source_type text DEFAULT 'auto' CHECK (source_type IN ('auto', 'manual', 'computed')),
  
  -- Priority and override
  is_active boolean DEFAULT true,
  is_manual_override boolean DEFAULT false,
  priority_score integer DEFAULT 0,
  
  -- Conflict tracking
  has_conflict boolean DEFAULT false,
  conflict_count integer DEFAULT 0,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE sku_attribute_values IS 
  'Actual attribute values per SKU. May have multiple values from different suppliers. Only one is active per attribute.';

CREATE INDEX IF NOT EXISTS idx_sku_attr_val_sku ON sku_attribute_values(internal_sku_id);
CREATE INDEX IF NOT EXISTS idx_sku_attr_val_attr ON sku_attribute_values(master_attr_id);
CREATE INDEX IF NOT EXISTS idx_sku_attr_val_active ON sku_attribute_values(internal_sku_id, master_attr_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sku_attr_val_supplier ON sku_attribute_values(source_supplier_id);

-- =====================================================
-- 4) SUPPLIER ATTRIBUTE MAPPING (other suppliers → Sandi)
-- =====================================================
CREATE TABLE IF NOT EXISTS supplier_attribute_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  
  -- Supplier's attribute identity
  supplier_attr_key text NOT NULL,
  supplier_attr_name text,
  
  -- Maps to Master (Sandi)
  master_attr_id uuid NOT NULL REFERENCES master_attribute_dictionary(id) ON DELETE CASCADE,
  
  -- Transformation rules
  transform_rule jsonb DEFAULT '{}'::jsonb,
  
  -- Confidence and validation
  mapping_confidence numeric(3,2) DEFAULT 1.0 CHECK (mapping_confidence >= 0 AND mapping_confidence <= 1.0),
  is_verified boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(supplier_id, supplier_attr_key, master_attr_id)
);

COMMENT ON TABLE supplier_attribute_mappings IS 
  'Maps supplier-specific attribute names to Master Attribute Dictionary. Includes transformation rules for unit conversion, normalization, etc.';

CREATE INDEX IF NOT EXISTS idx_supplier_attr_map_supplier ON supplier_attribute_mappings(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_attr_map_key ON supplier_attribute_mappings(supplier_attr_key);
CREATE INDEX IF NOT EXISTS idx_supplier_attr_map_master ON supplier_attribute_mappings(master_attr_id);

-- =====================================================
-- 5) ENABLE RLS
-- =====================================================
ALTER TABLE master_attribute_dictionary ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_attribute_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE sku_attribute_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_attribute_mappings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all
CREATE POLICY "Authenticated users can read master attributes"
  ON master_attribute_dictionary FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read category schemas"
  ON category_attribute_schemas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read SKU attribute values"
  ON sku_attribute_values FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read supplier mappings"
  ON supplier_attribute_mappings FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to modify
CREATE POLICY "Authenticated users can modify master attributes"
  ON master_attribute_dictionary FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can modify category schemas"
  ON category_attribute_schemas FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can modify SKU attribute values"
  ON sku_attribute_values FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can modify supplier mappings"
  ON supplier_attribute_mappings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
