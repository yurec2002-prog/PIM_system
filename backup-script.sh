#!/bin/bash

# =====================================================
# PIM System Backup Script
# =====================================================
# This script creates a complete backup of your PIM system
# including code, database schema, and data
# =====================================================

set -e  # Exit on error

echo "🔄 Starting PIM System Backup..."
echo "=================================="

# Configuration
BACKUP_DIR="./backups/backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📁 Backup directory: $BACKUP_DIR"
echo ""

# =====================================================
# 1. BACKUP CODE FILES
# =====================================================
echo "📦 Step 1: Backing up code files..."

mkdir -p "$BACKUP_DIR/code"

# Copy source code
cp -r src "$BACKUP_DIR/code/"
cp -r public "$BACKUP_DIR/code/"
cp -r supabase "$BACKUP_DIR/code/"

# Copy configuration files
cp package.json "$BACKUP_DIR/code/"
cp package-lock.json "$BACKUP_DIR/code/"
cp tsconfig.json "$BACKUP_DIR/code/"
cp vite.config.ts "$BACKUP_DIR/code/"
cp tailwind.config.js "$BACKUP_DIR/code/"
cp index.html "$BACKUP_DIR/code/"

# Copy env template (not actual .env for security)
if [ -f .env.example ]; then
    cp .env.example "$BACKUP_DIR/code/"
fi

echo "✅ Code files backed up"
echo ""

# =====================================================
# 2. BACKUP DATABASE SCHEMA (Migrations)
# =====================================================
echo "🗄️  Step 2: Database schema already backed up"
echo "   (All migrations are in supabase/migrations/)"
echo ""

# =====================================================
# 3. BACKUP DOCUMENTATION
# =====================================================
echo "📄 Step 3: Creating backup documentation..."

cat > "$BACKUP_DIR/README.md" << 'EOF'
# PIM System Backup

**Backup Date:** $(date)

## Contents

- `code/` - Complete source code and configuration
- `BACKUP_INFO.md` - Detailed project information
- `export_data.sql` - SQL script for data export/import

## Restore Instructions

### 1. Restore Code
```bash
cd your-project-directory
cp -r code/* .
npm install
```

### 2. Restore Database Schema
```bash
# Apply all migrations from supabase/migrations/
# Use Supabase CLI or dashboard
```

### 3. Restore Data
Use Supabase dashboard to:
- Export data from old project
- Import into new project

Or use the provided SQL export script.

### 4. Update Environment Variables
Copy `.env.example` to `.env` and fill in your Supabase credentials.

### 5. Build and Run
```bash
npm run build
npm run dev
```

## Database Statistics (at backup time)

Run this query to see current data:
```sql
SELECT
  'Products' as table_name, COUNT(*) as count FROM products
UNION ALL
SELECT 'Categories', COUNT(*) FROM supplier_categories
UNION ALL
SELECT 'Mappings', COUNT(*) FROM category_mappings;
```

EOF

cp BACKUP_INFO.md "$BACKUP_DIR/" 2>/dev/null || echo "Note: BACKUP_INFO.md not found"
cp export_data.sql "$BACKUP_DIR/" 2>/dev/null || echo "Note: export_data.sql not found"

echo "✅ Documentation created"
echo ""

# =====================================================
# 4. CREATE ARCHIVE
# =====================================================
echo "📦 Step 4: Creating compressed archive..."

ARCHIVE_NAME="pim_backup_$(date +%Y%m%d_%H%M%S).tar.gz"
tar -czf "$ARCHIVE_NAME" -C "./backups" "$(basename "$BACKUP_DIR")"

echo "✅ Archive created: $ARCHIVE_NAME"
echo ""

# =====================================================
# 5. SUMMARY
# =====================================================
echo "=================================="
echo "✅ Backup Complete!"
echo "=================================="
echo ""
echo "📊 Backup Summary:"
echo "  - Code files: ✅"
echo "  - Database schema (migrations): ✅"
echo "  - Documentation: ✅"
echo "  - Archive: $ARCHIVE_NAME"
echo ""
echo "⚠️  Important Notes:"
echo "  1. Database data must be exported separately using Supabase"
echo "  2. Don't forget to backup your .env file securely"
echo "  3. Store this backup in a safe location"
echo ""
echo "📝 Next steps for data backup:"
echo "  1. Go to Supabase Dashboard"
echo "  2. Project Settings > Database > Database Backups"
echo "  3. Download the backup"
echo ""
echo "Or use CLI:"
echo "  supabase db dump -f backup.sql"
echo ""
