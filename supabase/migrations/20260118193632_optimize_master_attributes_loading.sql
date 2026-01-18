/*
  # Optimize master attributes loading

  ## Purpose
  Создает функцию для быстрой загрузки всех атрибутов с usage_count и aliases
  одним запросом вместо N+1 запросов

  ## Changes
  - Функция get_master_attributes_with_stats() - возвращает все атрибуты с агрегированными данными
  - Использует LEFT JOINs для подсчета usage и aliases
  - Возвращает jsonb массив aliases для каждого атрибута
*/

CREATE OR REPLACE FUNCTION get_master_attributes_with_stats()
RETURNS TABLE(
  id uuid,
  key text,
  code text,
  name text,
  name_uk text,
  name_en text,
  type text,
  source text,
  unit_kind text,
  default_unit text,
  needs_review boolean,
  usage_count bigint,
  created_at timestamptz,
  updated_at timestamptz,
  aliases jsonb
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    ma.id,
    ma.key,
    ma.code,
    ma.name,
    ma.name_uk,
    ma.name_en,
    ma.type,
    ma.source,
    ma.unit_kind,
    ma.default_unit,
    ma.needs_review,
    COUNT(DISTINCT ca.id) as usage_count,
    ma.created_at,
    ma.updated_at,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', aa.id,
            'text', aa.alias_text
          )
        )
        FROM attribute_aliases aa
        WHERE aa.attribute_id = ma.id
      ),
      '[]'::jsonb
    ) as aliases
  FROM master_attributes ma
  LEFT JOIN category_attributes ca ON ca.attribute_id = ma.id
  GROUP BY 
    ma.id, 
    ma.key, 
    ma.code, 
    ma.name,
    ma.name_uk,
    ma.name_en,
    ma.type,
    ma.source,
    ma.unit_kind,
    ma.default_unit,
    ma.needs_review,
    ma.created_at,
    ma.updated_at
  ORDER BY ma.name_uk NULLS LAST, ma.name;
$$;

COMMENT ON FUNCTION get_master_attributes_with_stats() IS 
  'Возвращает все атрибуты с usage_count и aliases одним запросом для оптимизации загрузки';
