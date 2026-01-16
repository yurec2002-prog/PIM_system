/*
  # Fix Category Attribute Stats with Boolean Logic

  1. Problem
    - Cannot use MAX() on UUID type
    - Need to check if ANY occurrence of an attribute is mapped

  2. Solution
    - Use BOOL_OR to check if any occurrence has mapping
    - BOOL_OR returns true if any mapped_master_attribute_id IS NOT NULL
    - This ensures each attribute is counted exactly once

  3. Technical Details
    - BOOL_OR(mapped_master_attribute_id IS NOT NULL) checks if any row is mapped
    - Each unique attribute name is counted once as either mapped or unmapped
*/

-- Recreate function with proper boolean logic
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
  unique_attributes AS (
    SELECT 
      attribute_name,
      BOOL_OR(mapped_master_attribute_id IS NOT NULL) as is_mapped
    FROM supplier_category_attribute_presence
    WHERE supplier_category_id IN (SELECT id FROM category_tree)
    GROUP BY attribute_name
  ),
  stats AS (
    SELECT 
      COUNT(*)::bigint as total,
      COUNT(*) FILTER (WHERE is_mapped)::bigint as mapped,
      COUNT(*) FILTER (WHERE NOT is_mapped)::bigint as unmapped
    FROM unique_attributes
  )
  SELECT 
    s.total,
    s.mapped,
    s.unmapped,
    get_category_product_count(p_category_id) as product_count
  FROM stats s;
END;
$$;
