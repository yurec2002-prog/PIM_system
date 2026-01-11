-- =====================================================
-- PIM System Data Export Script
-- Generated: 2026-01-11
-- =====================================================
--
-- This script exports all data from the PIM system.
-- To restore, first apply all migrations, then run this script.
--
-- Usage in psql:
--   psql -U postgres -d your_database -f export_data.sql
--
-- Or in Supabase SQL Editor:
--   Copy and paste sections as needed
-- =====================================================

-- =====================================================
-- SECTION 1: SUPPLIERS
-- =====================================================
-- Note: Export your suppliers data
-- Example:
-- COPY suppliers TO '/tmp/suppliers.csv' WITH CSV HEADER;

SELECT 'Exporting suppliers...' as status;
-- \COPY suppliers TO 'suppliers_backup.csv' WITH CSV HEADER;


-- =====================================================
-- SECTION 2: WAREHOUSES
-- =====================================================
SELECT 'Exporting warehouses...' as status;
-- \COPY warehouses TO 'warehouses_backup.csv' WITH CSV HEADER;


-- =====================================================
-- SECTION 3: BRANDS
-- =====================================================
SELECT 'Exporting brands...' as status;
-- \COPY brands TO 'brands_backup.csv' WITH CSV HEADER;


-- =====================================================
-- SECTION 4: INTERNAL CATEGORIES
-- =====================================================
SELECT 'Exporting internal_categories...' as status;
-- \COPY internal_categories TO 'internal_categories_backup.csv' WITH CSV HEADER;


-- =====================================================
-- SECTION 5: SUPPLIER CATEGORIES
-- =====================================================
SELECT 'Exporting supplier_categories...' as status;
-- \COPY supplier_categories TO 'supplier_categories_backup.csv' WITH CSV HEADER;


-- =====================================================
-- SECTION 6: CATEGORY MAPPINGS
-- =====================================================
SELECT 'Exporting category_mappings...' as status;
-- \COPY category_mappings TO 'category_mappings_backup.csv' WITH CSV HEADER;


-- =====================================================
-- SECTION 7: PRODUCTS
-- =====================================================
SELECT 'Exporting products...' as status;
-- \COPY products TO 'products_backup.csv' WITH CSV HEADER;


-- =====================================================
-- SECTION 8: PRODUCT PRICES
-- =====================================================
SELECT 'Exporting product_prices...' as status;
-- \COPY product_prices TO 'product_prices_backup.csv' WITH CSV HEADER;


-- =====================================================
-- SECTION 9: VARIANT PRICES
-- =====================================================
SELECT 'Exporting variant_prices...' as status;
-- \COPY variant_prices TO 'variant_prices_backup.csv' WITH CSV HEADER;


-- =====================================================
-- SECTION 10: STOCK
-- =====================================================
SELECT 'Exporting stock...' as status;
-- \COPY stock TO 'stock_backup.csv' WITH CSV HEADER;


-- =====================================================
-- SECTION 11: IMPORT LOGS
-- =====================================================
SELECT 'Exporting import_logs...' as status;
-- \COPY import_logs TO 'import_logs_backup.csv' WITH CSV HEADER;


-- =====================================================
-- SECTION 12: QUALITY DATA
-- =====================================================
SELECT 'Exporting product_quality_scores...' as status;
-- \COPY product_quality_scores TO 'quality_scores_backup.csv' WITH CSV HEADER;

SELECT 'Exporting category_quality_templates...' as status;
-- \COPY category_quality_templates TO 'quality_templates_backup.csv' WITH CSV HEADER;

SELECT 'Exporting quality_change_log...' as status;
-- \COPY quality_change_log TO 'quality_log_backup.csv' WITH CSV HEADER;


-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

SELECT 'Data Export Summary:' as summary;

SELECT
    'suppliers' as table_name,
    COUNT(*) as row_count
FROM suppliers
UNION ALL
SELECT 'warehouses', COUNT(*) FROM warehouses
UNION ALL
SELECT 'brands', COUNT(*) FROM brands
UNION ALL
SELECT 'internal_categories', COUNT(*) FROM internal_categories
UNION ALL
SELECT 'supplier_categories', COUNT(*) FROM supplier_categories
UNION ALL
SELECT 'category_mappings', COUNT(*) FROM category_mappings
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'product_prices', COUNT(*) FROM product_prices
UNION ALL
SELECT 'variant_prices', COUNT(*) FROM variant_prices
UNION ALL
SELECT 'stock', COUNT(*) FROM stock
UNION ALL
SELECT 'import_logs', COUNT(*) FROM import_logs
UNION ALL
SELECT 'product_quality_scores', COUNT(*) FROM product_quality_scores
UNION ALL
SELECT 'category_quality_templates', COUNT(*) FROM category_quality_templates
UNION ALL
SELECT 'quality_change_log', COUNT(*) FROM quality_change_log
ORDER BY table_name;

-- =====================================================
-- RESTORE INSTRUCTIONS
-- =====================================================
/*

To restore this database:

1. Create a new Supabase project or database
2. Apply all migrations in order from supabase/migrations/
3. Restore data in this order (to respect foreign keys):
   a. suppliers
   b. warehouses
   c. brands
   d. internal_categories
   e. supplier_categories
   f. category_mappings
   g. products
   h. product_prices
   i. variant_prices
   j. stock
   k. import_logs
   l. product_quality_scores
   m. category_quality_templates
   n. quality_change_log

Example restore command:
\COPY suppliers FROM 'suppliers_backup.csv' WITH CSV HEADER;
\COPY warehouses FROM 'warehouses_backup.csv' WITH CSV HEADER;
... etc

4. Verify data integrity:
   - Check foreign key relationships
   - Verify internal_sku sequence continues properly
   - Test quality score calculations
   - Verify RLS policies work correctly

5. Update sequences if needed:
   SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));

*/
