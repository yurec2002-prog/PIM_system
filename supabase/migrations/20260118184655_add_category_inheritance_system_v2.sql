/*
  # Добавление системы наследования схем категорий v2

  ## Изменения

  ### 1. Обновление category_attributes
    - Добавлено поле state ("active" | "disabled")
    - Добавлен уникальный индекс

  ### 2. Функция resolve_category_schema
    - Вычисляет итоговую схему с наследованием
    - Приоритет украинского языка

  ### 3. Функции управления
    - add/override/disable/reset category attributes
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'category_attributes' AND column_name = 'state') THEN
    ALTER TABLE category_attributes ADD COLUMN state text DEFAULT 'active' CHECK (state IN ('active', 'disabled'));
  END IF;
END $$;

UPDATE category_attributes SET state = 'active' WHERE state IS NULL;

DROP INDEX IF EXISTS idx_category_attributes_unique;
CREATE UNIQUE INDEX idx_category_attributes_unique 
  ON category_attributes(internal_category_id, attribute_id) 
  WHERE internal_category_id IS NOT NULL;

CREATE OR REPLACE FUNCTION get_category_path(p_category_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
AS $$
DECLARE
  v_path uuid[];
  v_current_id uuid;
  v_parent_id uuid;
BEGIN
  v_current_id := p_category_id;
  v_path := ARRAY[v_current_id];

  LOOP
    SELECT parent_id INTO v_parent_id
    FROM internal_categories
    WHERE id = v_current_id;

    EXIT WHEN v_parent_id IS NULL;

    v_path := v_parent_id || v_path;
    v_current_id := v_parent_id;
  END LOOP;

  RETURN v_path;
END;
$$;

CREATE OR REPLACE FUNCTION resolve_category_schema(p_category_id uuid)
RETURNS TABLE(
  category_id uuid,
  attribute_id uuid,
  attr_key text,
  attr_code text,
  display_name text,
  display_name_uk text,
  display_name_ru text,
  display_name_en text,
  attr_type text,
  attr_source text,
  unit_kind text,
  default_unit_final text,
  required_final boolean,
  visible_final boolean,
  position_final integer,
  constraints_final jsonb,
  attr_state text,
  origin text,
  inherited_from_category_id uuid,
  inherited_from_category_name text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_path uuid[];
  v_cat_id uuid;
  v_binding RECORD;
  v_resolved RECORD;
  v_position_counter integer := 0;
BEGIN
  v_path := get_category_path(p_category_id);

  CREATE TEMP TABLE IF NOT EXISTS temp_resolved (
    attribute_id uuid PRIMARY KEY,
    attr_key text,
    attr_code text,
    display_name text,
    display_name_uk text,
    display_name_ru text,
    display_name_en text,
    attr_type text,
    attr_source text,
    unit_kind text,
    default_unit_final text,
    required_final boolean,
    visible_final boolean,
    position_final integer,
    constraints_final jsonb,
    attr_state text,
    origin text,
    inherited_from_category_id uuid,
    inherited_from_category_name text
  ) ON COMMIT DROP;

  FOREACH v_cat_id IN ARRAY v_path
  LOOP
    FOR v_binding IN
      SELECT 
        ca.*,
        ma.key as ma_key,
        ma.code as ma_code,
        COALESCE(ma.name_uk, ma.name, ma.name_en) as name_uk,
        ma.name as name_ru,
        ma.name_en as name_en,
        ma.type as ma_type,
        ma.source as ma_source,
        ma.unit_kind as ma_unit_kind
      FROM category_attributes ca
      JOIN master_attributes ma ON ma.id = ca.attribute_id
      WHERE ca.internal_category_id = v_cat_id
      ORDER BY ca."position" NULLS LAST, ma.name_uk NULLS LAST, ma.name NULLS LAST
    LOOP
      SELECT * INTO v_resolved FROM temp_resolved WHERE attribute_id = v_binding.attribute_id;

      IF v_binding.state = 'disabled' THEN
        IF v_resolved.attribute_id IS NOT NULL THEN
          DELETE FROM temp_resolved WHERE attribute_id = v_binding.attribute_id;
        END IF;
      ELSE
        IF v_resolved.attribute_id IS NULL THEN
          v_position_counter := v_position_counter + 1;
          
          INSERT INTO temp_resolved VALUES (
            v_binding.attribute_id,
            v_binding.ma_key,
            v_binding.ma_code,
            v_binding.name_uk,
            v_binding.name_uk,
            v_binding.name_ru,
            v_binding.name_en,
            v_binding.ma_type,
            v_binding.ma_source,
            v_binding.ma_unit_kind,
            v_binding.default_unit,
            v_binding.required,
            v_binding.visible,
            COALESCE(v_binding."position", v_position_counter * 10),
            v_binding.constraints,
            v_binding.state,
            CASE WHEN v_cat_id = p_category_id THEN 'local' ELSE 'inherited' END,
            CASE WHEN v_cat_id = p_category_id THEN NULL ELSE v_cat_id END,
            CASE WHEN v_cat_id = p_category_id THEN NULL ELSE (SELECT COALESCE(name_uk, name) FROM internal_categories WHERE id = v_cat_id) END
          );
        ELSE
          UPDATE temp_resolved SET
            default_unit_final = COALESCE(v_binding.default_unit, default_unit_final),
            required_final = COALESCE(v_binding.required, required_final),
            visible_final = COALESCE(v_binding.visible, visible_final),
            position_final = COALESCE(v_binding."position", position_final),
            constraints_final = COALESCE(v_binding.constraints, constraints_final),
            attr_state = v_binding.state,
            origin = 'overridden'
          WHERE attribute_id = v_binding.attribute_id;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  RETURN QUERY
  SELECT 
    p_category_id,
    t.*
  FROM temp_resolved t
  WHERE t.attr_state = 'active'
  ORDER BY t.position_final NULLS LAST, t.display_name_uk NULLS LAST, t.display_name_ru NULLS LAST;
END;
$$;

CREATE OR REPLACE FUNCTION add_category_attribute(
  p_category_id uuid,
  p_attribute_id uuid,
  p_required boolean DEFAULT false,
  p_visible boolean DEFAULT true,
  p_position integer DEFAULT NULL,
  p_default_unit text DEFAULT NULL,
  p_constraints jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO category_attributes (
    internal_category_id,
    attribute_id,
    required,
    visible,
    "position",
    default_unit,
    constraints,
    state
  ) VALUES (
    p_category_id,
    p_attribute_id,
    p_required,
    p_visible,
    p_position,
    p_default_unit,
    p_constraints,
    'active'
  )
  ON CONFLICT (internal_category_id, attribute_id) 
  DO UPDATE SET
    required = EXCLUDED.required,
    visible = EXCLUDED.visible,
    "position" = EXCLUDED."position",
    default_unit = EXCLUDED.default_unit,
    constraints = EXCLUDED.constraints,
    state = 'active',
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION override_category_attribute(
  p_category_id uuid,
  p_attribute_id uuid,
  p_required boolean DEFAULT NULL,
  p_visible boolean DEFAULT NULL,
  p_position integer DEFAULT NULL,
  p_default_unit text DEFAULT NULL,
  p_constraints jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO category_attributes (
    internal_category_id,
    attribute_id,
    required,
    visible,
    "position",
    default_unit,
    constraints,
    state
  ) VALUES (
    p_category_id,
    p_attribute_id,
    p_required,
    p_visible,
    p_position,
    p_default_unit,
    p_constraints,
    'active'
  )
  ON CONFLICT (internal_category_id, attribute_id) 
  DO UPDATE SET
    required = COALESCE(EXCLUDED.required, category_attributes.required),
    visible = COALESCE(EXCLUDED.visible, category_attributes.visible),
    "position" = COALESCE(EXCLUDED."position", category_attributes."position"),
    default_unit = COALESCE(EXCLUDED.default_unit, category_attributes.default_unit),
    constraints = COALESCE(EXCLUDED.constraints, category_attributes.constraints),
    state = 'active',
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION disable_category_attribute(
  p_category_id uuid,
  p_attribute_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO category_attributes (
    internal_category_id,
    attribute_id,
    state
  ) VALUES (
    p_category_id,
    p_attribute_id,
    'disabled'
  )
  ON CONFLICT (internal_category_id, attribute_id) 
  DO UPDATE SET
    state = 'disabled',
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION reset_category_attribute(
  p_category_id uuid,
  p_attribute_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM category_attributes
  WHERE internal_category_id = p_category_id
    AND attribute_id = p_attribute_id;
END;
$$;

CREATE OR REPLACE FUNCTION get_local_category_attributes(p_category_id uuid)
RETURNS TABLE(
  id uuid,
  attribute_id uuid,
  attr_key text,
  attr_code text,
  display_name_uk text,
  display_name_ru text,
  display_name_en text,
  attr_type text,
  attr_source text,
  unit_kind text,
  default_unit text,
  required boolean,
  visible boolean,
  attr_position integer,
  constraints jsonb,
  attr_state text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ca.id,
    ca.attribute_id,
    ma.key,
    ma.code,
    COALESCE(ma.name_uk, ma.name, ma.name_en) as display_name_uk,
    ma.name as display_name_ru,
    ma.name_en as display_name_en,
    ma.type,
    ma.source,
    ma.unit_kind,
    ca.default_unit,
    ca.required,
    ca.visible,
    ca."position",
    ca.constraints,
    ca.state
  FROM category_attributes ca
  JOIN master_attributes ma ON ma.id = ca.attribute_id
  WHERE ca.internal_category_id = p_category_id
  ORDER BY ca."position" NULLS LAST, ma.name_uk NULLS LAST, ma.name NULLS LAST;
END;
$$;
