/*
  # Рефакторинг доменной модели атрибутов

  ## Изменения

  ### 1. Обновление master_attributes (GLOBAL Dictionary)
    - key, source, needs_review, unit_kind, default_unit, name_en

  ### 2. category_attributes (Schema Bindings)
    - Привязка атрибута к категории

  ### 3. attribute_aliases
    - Синонимы атрибутов

  ### 4. attribute_inbox
    - Очередь неопознанных атрибутов
*/

-- Шаг 1: Обновить master_attributes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'master_attributes' AND column_name = 'key') THEN
    ALTER TABLE master_attributes ADD COLUMN key text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'master_attributes' AND column_name = 'code') THEN
    ALTER TABLE master_attributes ADD COLUMN code text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'master_attributes' AND column_name = 'source') THEN
    ALTER TABLE master_attributes ADD COLUMN source text DEFAULT 'manual';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'master_attributes' AND column_name = 'needs_review') THEN
    ALTER TABLE master_attributes ADD COLUMN needs_review boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'master_attributes' AND column_name = 'unit_kind') THEN
    ALTER TABLE master_attributes ADD COLUMN unit_kind text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'master_attributes' AND column_name = 'default_unit') THEN
    ALTER TABLE master_attributes ADD COLUMN default_unit text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'master_attributes' AND column_name = 'name_en') THEN
    ALTER TABLE master_attributes ADD COLUMN name_en text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'master_attributes_source_check') THEN
    ALTER TABLE master_attributes ADD CONSTRAINT master_attributes_source_check 
      CHECK (source IN ('sandi', 'manual', 'supplier'));
  END IF;
END $$;

UPDATE master_attributes SET key = 'manual:' || lower(regexp_replace(name, '[^a-zA-Zа-яА-ЯёЁ0-9]+', '_', 'g')) WHERE key IS NULL;
UPDATE master_attributes SET code = upper(regexp_replace(name, '[^a-zA-Zа-яА-ЯёЁ0-9]+', '_', 'g')) WHERE code IS NULL;
UPDATE master_attributes SET needs_review = true WHERE needs_review IS NULL OR needs_review = false;

DROP INDEX IF EXISTS idx_master_attributes_key;
CREATE UNIQUE INDEX idx_master_attributes_key ON master_attributes(key);

-- Шаг 2: category_attributes
CREATE TABLE IF NOT EXISTS category_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_category_id uuid REFERENCES supplier_categories(id) ON DELETE CASCADE,
  internal_category_id uuid REFERENCES internal_categories(id) ON DELETE CASCADE,
  attribute_id uuid NOT NULL REFERENCES master_attributes(id) ON DELETE CASCADE,
  required boolean DEFAULT false,
  visible boolean DEFAULT true,
  position integer DEFAULT 999,
  constraints jsonb DEFAULT '{}',
  default_unit text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_category_attribute') THEN
    ALTER TABLE category_attributes ADD CONSTRAINT unique_category_attribute UNIQUE(supplier_category_id, attribute_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_internal_category_attribute') THEN
    ALTER TABLE category_attributes ADD CONSTRAINT unique_internal_category_attribute UNIQUE(internal_category_id, attribute_id);
  END IF;
END $$;

ALTER TABLE category_attributes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view category attributes" ON category_attributes;
CREATE POLICY "Users can view category attributes" ON category_attributes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert category attributes" ON category_attributes;
CREATE POLICY "Users can insert category attributes" ON category_attributes FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update category attributes" ON category_attributes;
CREATE POLICY "Users can update category attributes" ON category_attributes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete category attributes" ON category_attributes;
CREATE POLICY "Users can delete category attributes" ON category_attributes FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_category_attributes_supplier_category ON category_attributes(supplier_category_id);
CREATE INDEX IF NOT EXISTS idx_category_attributes_internal_category ON category_attributes(internal_category_id);
CREATE INDEX IF NOT EXISTS idx_category_attributes_attribute ON category_attributes(attribute_id);

-- Мигрировать is_required
DO $$
DECLARE
  attr_record RECORD;
BEGIN
  FOR attr_record IN
    SELECT id, internal_category_id, is_required
    FROM master_attributes
    WHERE internal_category_id IS NOT NULL AND is_required IS NOT NULL
  LOOP
    INSERT INTO category_attributes (internal_category_id, attribute_id, required, visible, position)
    VALUES (attr_record.internal_category_id, attr_record.id, COALESCE(attr_record.is_required, false), true, 999)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Шаг 3: attribute_aliases
CREATE TABLE IF NOT EXISTS attribute_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id uuid NOT NULL REFERENCES master_attributes(id) ON DELETE CASCADE,
  alias_text text NOT NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE attribute_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view attribute aliases" ON attribute_aliases;
CREATE POLICY "Users can view attribute aliases" ON attribute_aliases FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert attribute aliases" ON attribute_aliases;
CREATE POLICY "Users can insert attribute aliases" ON attribute_aliases FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete attribute aliases" ON attribute_aliases;
CREATE POLICY "Users can delete attribute aliases" ON attribute_aliases FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_attribute_aliases_attribute ON attribute_aliases(attribute_id);
CREATE INDEX IF NOT EXISTS idx_attribute_aliases_text ON attribute_aliases(alias_text);

-- Мигрировать synonyms
DO $$
DECLARE
  attr_record RECORD;
  synonym text;
BEGIN
  FOR attr_record IN
    SELECT id, synonyms FROM master_attributes WHERE synonyms IS NOT NULL AND array_length(synonyms, 1) > 0
  LOOP
    FOREACH synonym IN ARRAY attr_record.synonyms
    LOOP
      INSERT INTO attribute_aliases (attribute_id, alias_text) VALUES (attr_record.id, synonym) ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Шаг 4: attribute_inbox
CREATE TABLE IF NOT EXISTS attribute_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_category_id uuid REFERENCES supplier_categories(id) ON DELETE SET NULL,
  raw_name text NOT NULL,
  raw_key text,
  normalized_key text,
  frequency integer DEFAULT 1,
  examples text[],
  status text DEFAULT 'new',
  suggested_attribute_id uuid REFERENCES master_attributes(id) ON DELETE SET NULL,
  resolved_attribute_id uuid REFERENCES master_attributes(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attribute_inbox_status_check') THEN
    ALTER TABLE attribute_inbox ADD CONSTRAINT attribute_inbox_status_check CHECK (status IN ('new', 'linked', 'created', 'ignored'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_inbox_item') THEN
    ALTER TABLE attribute_inbox ADD CONSTRAINT unique_inbox_item UNIQUE(supplier_id, raw_name, supplier_category_id);
  END IF;
END $$;

ALTER TABLE attribute_inbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view attribute inbox" ON attribute_inbox;
CREATE POLICY "Users can view attribute inbox" ON attribute_inbox FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert attribute inbox" ON attribute_inbox;
CREATE POLICY "Users can insert attribute inbox" ON attribute_inbox FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update attribute inbox" ON attribute_inbox;
CREATE POLICY "Users can update attribute inbox" ON attribute_inbox FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete attribute inbox" ON attribute_inbox;
CREATE POLICY "Users can delete attribute inbox" ON attribute_inbox FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_attribute_inbox_status ON attribute_inbox(status);
CREATE INDEX IF NOT EXISTS idx_attribute_inbox_supplier ON attribute_inbox(supplier_id);
CREATE INDEX IF NOT EXISTS idx_attribute_inbox_resolved ON attribute_inbox(resolved_attribute_id);

-- Мигрировать из supplier_category_attribute_presence
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'supplier_category_attribute_presence') THEN
    INSERT INTO attribute_inbox (
      supplier_id, supplier_category_id, raw_name, frequency, examples, status, resolved_attribute_id
    )
    SELECT
      supplier_id,
      supplier_category_id,
      attribute_name,
      frequency_count,
      CASE 
        WHEN example_values IS NOT NULL THEN 
          ARRAY(SELECT jsonb_array_elements_text(example_values))
        ELSE ARRAY[]::text[]
      END,
      CASE WHEN mapped_master_attribute_id IS NOT NULL THEN 'linked' ELSE 'new' END,
      mapped_master_attribute_id
    FROM supplier_category_attribute_presence
    ON CONFLICT (supplier_id, raw_name, supplier_category_id) DO NOTHING;
  END IF;
END $$;

-- Helper функции
CREATE OR REPLACE FUNCTION generate_attribute_key(p_source text, p_name text, p_supplier_id uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_normalized text;
  v_key text;
  v_counter integer := 0;
BEGIN
  v_normalized := lower(regexp_replace(p_name, '[^a-zA-Zа-яА-ЯёЁ0-9]+', '_', 'g'));
  v_normalized := trim(both '_' from v_normalized);
  IF p_supplier_id IS NOT NULL THEN
    v_key := p_source || ':' || p_supplier_id::text || ':' || v_normalized;
  ELSE
    v_key := p_source || ':' || v_normalized;
  END IF;
  WHILE EXISTS (SELECT 1 FROM master_attributes WHERE key = v_key) LOOP
    v_counter := v_counter + 1;
    v_key := p_source || ':' || v_normalized || '_' || v_counter::text;
  END LOOP;
  RETURN v_key;
END;
$$;

CREATE OR REPLACE FUNCTION find_attribute_by_alias(p_alias text)
RETURNS TABLE(attribute_id uuid, name text, name_uk text, type text, match_type text)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ma.id, ma.name, ma.name_uk, ma.type, 'alias'::text as match_type
  FROM master_attributes ma
  JOIN attribute_aliases aa ON aa.attribute_id = ma.id
  WHERE lower(aa.alias_text) = lower(p_alias)
  UNION
  SELECT ma.id, ma.name, ma.name_uk, ma.type, 'exact'::text as match_type
  FROM master_attributes ma
  WHERE lower(ma.name) = lower(p_alias) OR lower(ma.name_uk) = lower(p_alias);
END;
$$;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_category_attributes_updated_at ON category_attributes;
CREATE TRIGGER update_category_attributes_updated_at
  BEFORE UPDATE ON category_attributes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_attribute_inbox_updated_at ON attribute_inbox;
CREATE TRIGGER update_attribute_inbox_updated_at
  BEFORE UPDATE ON attribute_inbox FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
