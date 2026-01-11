/*
  # Add Data Quality and Automation System
  
  1. New Tables
    - `category_quality_templates` - Quality requirements per internal category
      - `id` (uuid, primary key)
      - `internal_category_id` (uuid, references internal_categories)
      - `required_attributes` (jsonb) - List of required attribute names
      - `minimum_image_count` (integer) - Minimum number of images required
      - `selling_price_required` (boolean) - Whether selling price is required
      - `created_at`, `updated_at` (timestamptz)
    
    - `variant_quality_scores` - Calculated quality scores for each variant
      - `id` (uuid, primary key)
      - `variant_id` (uuid, references variants)
      - `completeness_score` (integer) - Score 0-100
      - `not_ready_reasons` (jsonb) - Array of reason codes
      - `has_selling_price` (boolean)
      - `has_images` (boolean)
      - `has_category_mapping` (boolean)
      - `has_required_attributes` (boolean)
      - `calculated_at` (timestamptz)
    
    - `quality_change_logs` - Audit trail for automated changes
      - `id` (uuid, primary key)
      - `variant_id` (uuid, references variants)
      - `change_type` (text) - Type of change
      - `old_value` (text)
      - `new_value` (text)
      - `reason` (text) - Explanation
      - `triggered_by` (text) - What triggered the change
      - `created_at` (timestamptz)
    
    - `import_snapshots` - Snapshot of variant data for diff comparison
      - `id` (uuid, primary key)
      - `import_id` (uuid, references imports)
      - `variant_id` (uuid, references variants)
      - `external_id` (text)
      - `snapshot_data` (jsonb) - Full variant data at import time
      - `created_at` (timestamptz)
    
    - `import_diffs` - Detected changes between imports
      - `id` (uuid, primary key)
      - `import_id` (uuid, references imports)
      - `variant_id` (uuid, references variants)
      - `external_id` (text)
      - `field_name` (text) - What changed
      - `old_value` (text)
      - `new_value` (text)
      - `change_type` (text) - added, modified, removed
      - `created_at` (timestamptz)
  
  2. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users
  
  3. Indexes
    - Index on variant_id for all variant-related tables
    - Index on import_id for import-related tables
    - Index on completeness_score for filtering
    - Index on not_ready_reasons for filtering
*/

-- Create category_quality_templates table
CREATE TABLE IF NOT EXISTS category_quality_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_category_id uuid REFERENCES internal_categories(id) ON DELETE CASCADE NOT NULL,
  required_attributes jsonb DEFAULT '[]'::jsonb,
  minimum_image_count integer DEFAULT 1,
  selling_price_required boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(internal_category_id)
);

-- Create variant_quality_scores table
CREATE TABLE IF NOT EXISTS variant_quality_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid REFERENCES variants(id) ON DELETE CASCADE NOT NULL,
  completeness_score integer DEFAULT 0,
  not_ready_reasons jsonb DEFAULT '[]'::jsonb,
  has_selling_price boolean DEFAULT false,
  has_images boolean DEFAULT false,
  has_category_mapping boolean DEFAULT false,
  has_required_attributes boolean DEFAULT false,
  calculated_at timestamptz DEFAULT now(),
  UNIQUE(variant_id)
);

-- Create quality_change_logs table
CREATE TABLE IF NOT EXISTS quality_change_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid REFERENCES variants(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  change_type text NOT NULL,
  old_value text,
  new_value text,
  reason text NOT NULL,
  triggered_by text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create import_snapshots table
CREATE TABLE IF NOT EXISTS import_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid REFERENCES imports(id) ON DELETE CASCADE NOT NULL,
  variant_id uuid REFERENCES variants(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  snapshot_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create import_diffs table
CREATE TABLE IF NOT EXISTS import_diffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid REFERENCES imports(id) ON DELETE CASCADE NOT NULL,
  variant_id uuid REFERENCES variants(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  change_type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_category_quality_templates_category ON category_quality_templates(internal_category_id);
CREATE INDEX IF NOT EXISTS idx_variant_quality_scores_variant ON variant_quality_scores(variant_id);
CREATE INDEX IF NOT EXISTS idx_variant_quality_scores_score ON variant_quality_scores(completeness_score);
CREATE INDEX IF NOT EXISTS idx_variant_quality_scores_reasons ON variant_quality_scores USING gin(not_ready_reasons);
CREATE INDEX IF NOT EXISTS idx_quality_change_logs_variant ON quality_change_logs(variant_id);
CREATE INDEX IF NOT EXISTS idx_quality_change_logs_product ON quality_change_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_quality_change_logs_created ON quality_change_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_snapshots_import ON import_snapshots(import_id);
CREATE INDEX IF NOT EXISTS idx_import_snapshots_variant ON import_snapshots(variant_id);
CREATE INDEX IF NOT EXISTS idx_import_snapshots_external ON import_snapshots(external_id);
CREATE INDEX IF NOT EXISTS idx_import_diffs_import ON import_diffs(import_id);
CREATE INDEX IF NOT EXISTS idx_import_diffs_variant ON import_diffs(variant_id);
CREATE INDEX IF NOT EXISTS idx_import_diffs_external ON import_diffs(external_id);

-- Enable Row Level Security
ALTER TABLE category_quality_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_quality_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_change_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_diffs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Authenticated users can view category_quality_templates"
  ON category_quality_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert category_quality_templates"
  ON category_quality_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update category_quality_templates"
  ON category_quality_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete category_quality_templates"
  ON category_quality_templates FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view variant_quality_scores"
  ON variant_quality_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert variant_quality_scores"
  ON variant_quality_scores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update variant_quality_scores"
  ON variant_quality_scores FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete variant_quality_scores"
  ON variant_quality_scores FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view quality_change_logs"
  ON quality_change_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert quality_change_logs"
  ON quality_change_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can view import_snapshots"
  ON import_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert import_snapshots"
  ON import_snapshots FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can view import_diffs"
  ON import_diffs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert import_diffs"
  ON import_diffs FOR INSERT TO authenticated WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_category_quality_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER category_quality_templates_updated_at
  BEFORE UPDATE ON category_quality_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_category_quality_template_updated_at();
