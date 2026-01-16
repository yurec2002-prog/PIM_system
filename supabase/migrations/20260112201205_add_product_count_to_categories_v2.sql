/*
  # Add Product Count Tracking to Categories

  1. New Functions
    - `get_category_product_count` - Counts products in a category and all its descendants
    - Updates `get_category_attribute_stats` to include product count

  2. Changes
    - Drop and recreate stats function with product_count field
    - Add recursive product counting for category hierarchies
    - Product count includes all products in current category and child categories
*/

-- Function to get product count for a category (including descendants)
CREATE OR REPLACE FUNCTION get_category_product_count(p_category_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Count products in this category and all descendant categories
  WITH RECURSIVE category_tree AS (
    -- Start with the given category
    SELECT id FROM supplier_categories WHERE id = p_category_id
    UNION ALL
    -- Recursively get all children
    SELECT sc.id 
    FROM supplier_categories sc
    INNER JOIN category_tree ct ON sc.parent_id = ct.id
  )
  SELECT COUNT(DISTINCT sp.id)::integer
  INTO v_count
  FROM supplier_products sp
  WHERE sp.supplier_category_id IN (SELECT id FROM category_tree);
  
  RETURN COALESCE(v_count, 0);
END;
$$;

-- Drop the old function
DROP FUNCTION IF EXISTS get_category_attribute_stats(uuid);

-- Recreate with product_count field
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
      COUNT(*)::bigint as total,
      COUNT(mapped_master_attribute_id)::bigint as mapped,
      COUNT(*) FILTER (WHERE mapped_master_attribute_id IS NULL)::bigint as unmapped
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