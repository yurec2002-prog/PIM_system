/*
  # Fix Category Attribute Stats to Count Distinct Attributes

  1. Changes
    - Update `get_category_attribute_stats` to count DISTINCT attribute names
    - This prevents double-counting when the same attribute appears in parent and child categories
    - For example, if attribute "Тип системи" appears in both parent "Система опалення" 
      and child "Водогрівальні прилади", it should only be counted once

  2. Technical Details
    - Changed COUNT(*) to COUNT(DISTINCT attribute_name)
    - Mapped/unmapped counts now also use DISTINCT attribute_name
    - This gives accurate unique attribute counts across category hierarchies
*/

-- Recreate function with DISTINCT counting
CREATE OR REPLACE FUNCTION get_category_attribute_stats(p_category_id uuid)
RETURNS TABLE(
  total_count bigint,
  mapped_count bigint,
  unmapped_count bigint,
  product_count integer
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE category_tree AS (
    -- Start with the given category
    SELECT id FROM supplier_categories WHERE id = p_category_id
    UNION ALL
    -- Recursively get all children
    SELECT sc.id 
    FROM supplier_categories sc
    INNER JOIN category_tree ct ON sc.parent_id = ct.id
  ),
  stats AS (
    SELECT 
      COUNT(DISTINCT attribute_name)::bigint as total,
      COUNT(DISTINCT attribute_name) FILTER (WHERE mapped_master_attribute_id IS NOT NULL)::bigint as mapped,
      COUNT(DISTINCT attribute_name) FILTER (WHERE mapped_master_attribute_id IS NULL)::bigint as unmapped
    FROM supplier_category_attribute_presence
    WHERE supplier_category_id IN (SELECT id FROM category_tree)
  )
  SELECT 
    s.total,
    s.mapped,
    s.unmapped,
    get_category_product_count(p_category_id) as product_count
  FROM stats s;
END;
$$;
