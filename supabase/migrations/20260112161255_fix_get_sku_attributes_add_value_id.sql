/*
  # Fix get_sku_attributes_with_sources - Add Value ID

  1. Changes
    - Adds value_id to all_values JSON for switching between values
*/

CREATE OR REPLACE FUNCTION get_sku_attributes_with_sources(p_internal_sku_id uuid)
RETURNS TABLE(
  master_attr_id uuid,
  attr_name_ru text,
  attr_type text,
  attr_unit text,
  is_required boolean,
  active_value text,
  active_source_supplier_id uuid,
  active_source_supplier_name text,
  is_manual_override boolean,
  has_conflict boolean,
  conflict_count integer,
  all_values jsonb
)
LANGUAGE sql
AS $$
  SELECT 
    mad.id as master_attr_id,
    mad.name_ru as attr_name_ru,
    mad.type as attr_type,
    mad.unit as attr_unit,
    COALESCE(cas.is_required, false) as is_required,
    
    active_val.value as active_value,
    active_val.source_supplier_id as active_source_supplier_id,
    active_supplier.name as active_source_supplier_name,
    active_val.is_manual_override,
    active_val.has_conflict,
    active_val.conflict_count,
    
    (SELECT jsonb_agg(
       jsonb_build_object(
         'id', sav.id,
         'value', sav.value,
         'supplier_id', sav.source_supplier_id,
         'supplier_name', s.name,
         'is_active', sav.is_active,
         'priority_score', sav.priority_score
       ) ORDER BY sav.priority_score DESC
     )
     FROM sku_attribute_values sav
     JOIN suppliers s ON s.id = sav.source_supplier_id
     WHERE sav.internal_sku_id = p_internal_sku_id 
       AND sav.master_attr_id = mad.id
    ) as all_values
    
  FROM master_attribute_dictionary mad
  JOIN sku_attribute_values active_val ON active_val.master_attr_id = mad.id 
    AND active_val.internal_sku_id = p_internal_sku_id
    AND active_val.is_active = true
  JOIN suppliers active_supplier ON active_supplier.id = active_val.source_supplier_id
  LEFT JOIN (
    SELECT cas.master_attr_id, cas.is_required, cas.priority_override
    FROM category_attribute_schemas cas
    JOIN internal_skus isk ON isk.internal_category_id = cas.internal_category_id
    WHERE isk.id = p_internal_sku_id
  ) cas ON cas.master_attr_id = mad.id
  ORDER BY COALESCE(cas.priority_override, mad.priority) DESC, mad.name_ru;
$$;
