/*
  # Добавление системы алиасов и suggested matches v4

  ## Изменения

  ### 1. Обновление attribute_aliases
    - Добавлено поле normalized_alias для поиска
    - Удаление дубликатов
    - Уникальный индекс

  ### 2. Обновление attribute_inbox
    - Добавлено suggested_confidence

  ### 3. Функции для нормализации и поиска
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attribute_aliases' AND column_name = 'normalized_alias') THEN
    ALTER TABLE attribute_aliases ADD COLUMN normalized_alias text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attribute_inbox' AND column_name = 'suggested_confidence') THEN
    ALTER TABLE attribute_inbox ADD COLUMN suggested_confidence float;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION normalize_alias_text(p_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_normalized text;
BEGIN
  v_normalized := lower(trim(p_text));
  v_normalized := regexp_replace(v_normalized, '\s+', ' ', 'g');
  v_normalized := regexp_replace(v_normalized, '\([^)]*\)\s*$', '', 'g');
  v_normalized := regexp_replace(v_normalized, '(кг|г|мм|см|м|вт|а|в|bar|mm|cm|kg|w|a|v)\s*$', '', 'gi');
  v_normalized := trim(v_normalized);
  RETURN v_normalized;
END;
$$;

UPDATE attribute_aliases
SET normalized_alias = normalize_alias_text(alias_text)
WHERE normalized_alias IS NULL;

DELETE FROM attribute_aliases
WHERE id IN (
  SELECT id FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY attribute_id, normalized_alias, COALESCE(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid)
        ORDER BY created_at ASC
      ) as rn
    FROM attribute_aliases
  ) t
  WHERE t.rn > 1
);

CREATE OR REPLACE FUNCTION set_normalized_alias()
RETURNS TRIGGER AS $$
BEGIN
  NEW.normalized_alias := normalize_alias_text(NEW.alias_text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_normalized_alias ON attribute_aliases;
CREATE TRIGGER trigger_set_normalized_alias
  BEFORE INSERT OR UPDATE OF alias_text ON attribute_aliases
  FOR EACH ROW
  EXECUTE FUNCTION set_normalized_alias();

DROP INDEX IF EXISTS idx_attribute_aliases_unique;
CREATE UNIQUE INDEX idx_attribute_aliases_unique 
  ON attribute_aliases(attribute_id, normalized_alias, COALESCE(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid));

DROP INDEX IF EXISTS idx_attribute_aliases_normalized;
CREATE INDEX idx_attribute_aliases_normalized ON attribute_aliases(normalized_alias);

CREATE OR REPLACE FUNCTION find_suggested_attribute(p_raw_name text)
RETURNS TABLE(
  attribute_id uuid,
  confidence float
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_normalized text;
  v_attr_id uuid;
BEGIN
  v_normalized := normalize_alias_text(p_raw_name);

  SELECT aa.attribute_id INTO v_attr_id
  FROM attribute_aliases aa
  WHERE aa.normalized_alias = v_normalized
  LIMIT 1;

  IF v_attr_id IS NOT NULL THEN
    RETURN QUERY SELECT v_attr_id, 1.0::float;
    RETURN;
  END IF;

  SELECT ma.id INTO v_attr_id
  FROM master_attributes ma
  WHERE lower(ma.code) = v_normalized
  LIMIT 1;

  IF v_attr_id IS NOT NULL THEN
    RETURN QUERY SELECT v_attr_id, 0.95::float;
    RETURN;
  END IF;

  SELECT ma.id INTO v_attr_id
  FROM master_attributes ma
  WHERE normalize_alias_text(ma.name) = v_normalized
  LIMIT 1;

  IF v_attr_id IS NOT NULL THEN
    RETURN QUERY SELECT v_attr_id, 0.9::float;
    RETURN;
  END IF;

  SELECT ma.id INTO v_attr_id
  FROM master_attributes ma
  WHERE normalize_alias_text(ma.name) LIKE '%' || v_normalized || '%'
  LIMIT 1;

  IF v_attr_id IS NOT NULL THEN
    RETURN QUERY SELECT v_attr_id, 0.7::float;
    RETURN;
  END IF;

  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION update_inbox_suggestions()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  inbox_record RECORD;
  suggestion RECORD;
BEGIN
  FOR inbox_record IN
    SELECT id, raw_name
    FROM attribute_inbox
    WHERE status = 'new' AND suggested_attribute_id IS NULL
  LOOP
    SELECT * INTO suggestion FROM find_suggested_attribute(inbox_record.raw_name);
    
    IF suggestion.attribute_id IS NOT NULL THEN
      UPDATE attribute_inbox
      SET 
        suggested_attribute_id = suggestion.attribute_id,
        suggested_confidence = suggestion.confidence,
        updated_at = now()
      WHERE id = inbox_record.id;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION batch_link_suggested(p_inbox_ids uuid[])
RETURNS TABLE(
  inbox_id uuid,
  success boolean,
  error_message text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_inbox_id uuid;
  v_inbox_item RECORD;
BEGIN
  FOREACH v_inbox_id IN ARRAY p_inbox_ids
  LOOP
    BEGIN
      SELECT * INTO v_inbox_item
      FROM attribute_inbox
      WHERE id = v_inbox_id AND status = 'new' AND suggested_attribute_id IS NOT NULL;

      IF v_inbox_item.id IS NULL THEN
        RETURN QUERY SELECT v_inbox_id, false, 'Item not found or no suggestion'::text;
        CONTINUE;
      END IF;

      UPDATE attribute_inbox
      SET 
        resolved_attribute_id = v_inbox_item.suggested_attribute_id,
        status = 'linked',
        updated_at = now()
      WHERE id = v_inbox_id;

      INSERT INTO attribute_aliases (attribute_id, alias_text, supplier_id)
      VALUES (v_inbox_item.suggested_attribute_id, v_inbox_item.raw_name, v_inbox_item.supplier_id)
      ON CONFLICT DO NOTHING;

      RETURN QUERY SELECT v_inbox_id, true, NULL::text;

    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT v_inbox_id, false, SQLERRM::text;
    END;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION auto_suggest_on_inbox_insert()
RETURNS TRIGGER AS $$
DECLARE
  suggestion RECORD;
BEGIN
  IF NEW.status = 'new' AND NEW.suggested_attribute_id IS NULL THEN
    SELECT * INTO suggestion FROM find_suggested_attribute(NEW.raw_name);
    
    IF suggestion.attribute_id IS NOT NULL THEN
      NEW.suggested_attribute_id := suggestion.attribute_id;
      NEW.suggested_confidence := suggestion.confidence;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_suggest_inbox ON attribute_inbox;
CREATE TRIGGER trigger_auto_suggest_inbox
  BEFORE INSERT ON attribute_inbox
  FOR EACH ROW
  EXECUTE FUNCTION auto_suggest_on_inbox_insert();

SELECT update_inbox_suggestions();
