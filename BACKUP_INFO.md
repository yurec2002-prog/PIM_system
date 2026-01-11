# PIM System Backup Information

**Date:** 2026-01-11

## Project Overview
Complete PIM (Product Information Management) system with:
- Product management with quality scoring
- Category mapping (supplier ↔ internal)
- Multi-language support (RU/UK)
- Price management with automatic calculations
- Internal SKU system (VOD00000001 format)
- Import/Export functionality

## Database Statistics

| Table | Row Count |
|-------|-----------|
| Products | 223 |
| Supplier Categories | 503 |
| Internal Categories | 503 |
| Category Mappings | 503 |
| Product Prices | 629 |
| Brands | 24 |
| Suppliers | 1 |
| Warehouses | 7 |
| Import Logs | 46 |

## File Structure

### Code Files
```
src/
├── components/
│   ├── Auth/Login.tsx
│   ├── Categories/
│   │   ├── CategoryMapping.tsx
│   │   └── SupplierCategoryTree.tsx
│   ├── Export/Export.tsx
│   ├── Import/
│   │   ├── Import.tsx
│   │   ├── ImportDetails.tsx
│   │   ├── ImportHistory.tsx
│   │   └── CategorySelector.tsx
│   ├── Layout/Dashboard.tsx
│   ├── Products/
│   │   ├── ProductsList.tsx
│   │   ├── ProductDetails.tsx
│   │   └── AttributesTable.tsx
│   └── Quality/
│       ├── QualityIndicator.tsx
│       ├── QualityLogs.tsx
│       └── CategoryQualityTemplates.tsx
├── contexts/AuthContext.tsx
├── utils/
│   ├── sandiJsonParser.ts
│   ├── ymlParser.ts
│   ├── preScanParser.ts
│   ├── importDiffs.ts
│   ├── priceCalculations.ts
│   ├── qualityCalculations.ts
│   ├── categorySimilarity.ts
│   └── attributeHelpers.ts
└── types/pim.ts
```

### Database Migrations
```
supabase/migrations/
├── 20260110085314_create_pim_schema.sql
├── 20260110090159_create_pim_structure.sql
├── 20260110110859_add_variant_prices_table.sql
├── 20260110113415_add_product_readiness_function.sql
├── 20260110115954_add_description_to_internal_categories.sql
├── 20260110125851_add_sandi_json_support.sql
├── 20260110132313_update_variant_prices_flexible_types.sql
├── 20260110132609_add_multilingual_supplier_categories.sql
├── 20260110133247_add_warehouses_table.sql
├── 20260110142930_add_brands_and_import_logs.sql
├── 20260110143731_update_product_readiness_check_stock.sql
├── 20260110182527_add_import_selected_categories.sql
├── 20260110193533_add_attributes_multilingual_and_pinning.sql
├── 20260110200513_add_data_quality_system.sql
├── 20260110213054_refactor_to_proper_pim_architecture.sql
├── 20260110220926_remove_old_category_id_from_products.sql
├── 20260110221047_update_readiness_function_for_new_categories.sql
├── 20260110223104_fix_calculate_product_quality_function.sql
├── 20260110223447_fix_price_trigger_for_delete.sql
├── 20260110223724_fix_category_quality_templates_type.sql
├── 20260110224038_fix_infinite_recursion_in_quality_trigger.sql
├── 20260111165747_remove_price_type_constraint.sql
├── 20260111174050_update_quality_calculation_for_new_schema.sql
├── 20260111174126_fix_quality_calculation_use_internal_category_id.sql
├── 20260111174238_fix_infinite_recursion_proper_trigger.sql
├── 20260111175329_fix_quality_calculation_check_category_mapping.sql
├── 20260111183000_add_quality_change_logging_triggers.sql
├── 20260111183059_fix_quality_logging_format_strings.sql
└── 20260111184646_add_internal_sku_system.sql
```

## Key Features

### 1. Internal SKU System
- Format: `VOD00000001`, `VOD00000002`, etc.
- Auto-assigned on product creation
- Sequential numbering
- Separate from supplier SKU

### 2. Category System
- Supplier categories (from imports)
- Internal categories (our taxonomy)
- Mapping between supplier ↔ internal
- Tree structure with parent/child relationships
- Bulk operations (copy tree, map all descendants)

### 3. Quality Scoring
- Automatic completeness calculation
- Category-specific quality templates
- Quality change logging
- Required fields tracking

### 4. Multi-language Support
- Russian (RU) and Ukrainian (UK)
- Product names, descriptions, attributes
- Category names in multiple languages

### 5. Price Management
- Multiple price types (retail, purchase, etc.)
- Automatic margin calculations
- Price history tracking

### 6. Import System
- Sandi JSON format support
- YML format support
- Pre-scan before import
- Diff detection (new, changed, unchanged products)
- Category selection during import
- Import history with logs

## Restore Instructions

### 1. Database Schema
Run all migrations in order:
```bash
# Migrations are in supabase/migrations/
# Apply them sequentially using Supabase CLI or dashboard
```

### 2. Environment Variables
Ensure `.env` contains:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Build
```bash
npm run build
```

### 5. Export/Import Data
Use Supabase dashboard or CLI to:
- Export data: `pg_dump` or Supabase backup
- Import data: `psql` or Supabase restore

## Database Functions

### Key Functions:
- `generate_next_internal_sku()` - Generates next SKU (VOD00000001, etc.)
- `assign_internal_sku()` - Trigger to auto-assign SKU
- `calculate_product_quality(product_id)` - Calculates quality score
- `update_product_readiness_for_supplier(supplier_uuid)` - Updates readiness flags

### Triggers:
- Auto-assign internal SKU on insert
- Recalculate quality on product/price changes
- Log quality changes
- Update readiness status

## Important Notes

1. **Data Safety**: All migrations use `IF EXISTS` / `IF NOT EXISTS` clauses
2. **RLS**: All tables have Row Level Security enabled
3. **Indexes**: Optimized indexes on frequently queried fields
4. **Constraints**: Foreign keys maintain referential integrity
5. **Audit**: Quality changes are logged with timestamps

## Contact
For questions or issues, refer to the code comments and migration files for detailed documentation.
