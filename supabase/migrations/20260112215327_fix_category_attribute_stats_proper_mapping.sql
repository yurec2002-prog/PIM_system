/*
  # Fix Category Attribute Stats Mapping Logic

  1. Problem
    - Previous version counted distinct attributes separately for mapped and unmapped
    - If the same attribute appears in multiple categories with different mapping states,
      it could be counted in both mapped and unmapped
    - Example: "Тип системи" in category A (mapped) and category B (unmapped)
      would be counted as both mapped AND unmapped

  2. Solution
    - First, get unique attributes across all categories
    - For each unique attribute, check if ANY of its occurrences is mapped
    - If at least one occurrence is mapped, count as mapped
    - Otherwise, count as unmapped

  3. Technical Details
    - Use MAX(mapped_master_attribute_id) to check if any occurrence is mapped
    - This ensures each attribute is counted exactly once in either mapped or unmapped
*/

-- Recreate function with proper mapping logic
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
      MAX(mapped_master_attribute_id) as any_mapping
    FROM supplier_category_attribute_presence
    WHERE supplier_category_id IN (SELECT id FROM category_tree)
    GROUP BY attribute_name
  ),
  stats AS (
    SELECT 
      COUNT(*)::bigint as total,
      COUNT(*) FILTER (WHERE any_mapping IS NOT NULL)::bigint as mapped,
      COUNT(*) FILTER (WHERE any_mapping IS NULL)::bigint as unmapped
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
