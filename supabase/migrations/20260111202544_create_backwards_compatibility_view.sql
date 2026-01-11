/*
  # Create Backwards Compatibility View

  ## Purpose
  Create a view that makes internal_skus look like the old products table.
  This allows existing UI components to continue working while we gradually
  migrate to the new multi-supplier architecture.

  ## View: products_view
  - Mirrors the old products table structure
  - Pulls data from internal_skus
  - Includes data from primary supplier product
  - Can be queried exactly like the old products table
*/

CREATE OR REPLACE VIEW products_view AS
SELECT 
  -- Use a hash of internal_sku as integer ID for backwards compatibility
  ('x'||substr(md5(isk.internal_sku), 1, 8))::bit(32)::int as id,
  
  -- Supplier info (from preferred supplier)
  COALESCE(s.code, 'sandi') as supplier,
  
  -- SKU and identifiers
  COALESCE(
    (SELECT sp.supplier_sku FROM supplier_products sp 
     JOIN sku_links sl ON sl.supplier_product_id = sp.id 
     WHERE sl.internal_sku_id = isk.id AND sl.is_primary = true LIMIT 1),
    isk.internal_sku
  ) as supplier_sku,
  
  isk.barcode,
  isk.vendor_code,
  isk.brand_ref,
  
  -- Category (keep as null for now, will need mapping)
  NULL::integer as category_id,
  
  -- Product data
  isk.name_ru,
  isk.name_uk,
  isk.description_ru,
  isk.description_uk,
  
  -- Attributes (convert to old format)
  isk.attributes as attributes_ru,
  isk.attributes as attributes_uk,
  
  -- Images
  isk.images,
  CASE 
    WHEN jsonb_array_length(isk.images) > 0 
    THEN isk.images->0->> 0
    ELSE ''
  END as main_image,
  
  -- Stock and readiness
  isk.total_stock,
  isk.is_ready,
  isk.quality_score as completeness_score,
  
  -- Internal SKU for reference
  isk.internal_sku,
  
  -- Metadata
  isk.created_at,
  isk.updated_at,
  
  -- Readiness info
  to_jsonb(isk.blocking_reasons) as blocking_reasons,
  isk.blocking_reasons_text,
  to_jsonb(isk.warnings) as warnings,
  isk.warnings_text,
  
  -- Category IDs
  isk.internal_category_id,
  (SELECT sp.supplier_category_id FROM supplier_products sp 
   JOIN sku_links sl ON sl.supplier_product_id = sp.id 
   WHERE sl.internal_sku_id = isk.id AND sl.is_primary = true LIMIT 1) as supplier_category_id

FROM internal_skus isk
LEFT JOIN suppliers s ON s.id = isk.preferred_supplier_id;

-- Grant permissions
GRANT SELECT ON products_view TO authenticated;

COMMENT ON VIEW products_view IS 'Backwards compatibility view - maps internal_skus to look like old products table';
