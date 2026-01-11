/*
  # Quality Change Logging Triggers
  
  ## Overview
  Implements automatic logging of quality-related changes to products, capturing:
  - Readiness status changes (is_ready)
  - Quality score changes (completeness_score)
  - Category mapping changes
  - Price updates (significant changes >10%)
  - Stock updates (availability changes)
  
  ## Changes Made
  
  1. **Trigger Functions**
     - `log_product_quality_changes()` - Tracks changes to is_ready and completeness_score in products table
     - `log_category_mapping_changes()` - Tracks when supplier categories are mapped to internal categories
     - `log_price_changes()` - Tracks significant price changes (>10%) in product_prices table
     - `log_stock_changes()` - Tracks stock availability changes in warehouse_stocks table
  
  2. **Triggers**
     - Products table: logs readiness and quality score changes
     - Category mappings table: logs category assignments
     - Product prices table: logs price changes
     - Warehouse stocks table: logs stock availability changes
  
  3. **Security**
     - All trigger functions use SECURITY DEFINER to bypass RLS during logging
     - Logging is automatic and transparent to users
     - Read access granted to authenticated users
*/

-- Function to log product quality and readiness changes
CREATE OR REPLACE FUNCTION log_product_quality_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log readiness status changes
  IF (TG_OP = 'UPDATE' AND OLD.is_ready IS DISTINCT FROM NEW.is_ready) THEN
    INSERT INTO quality_change_logs (
      product_id,
      change_type,
      old_value,
      new_value,
      reason,
      triggered_by
    ) VALUES (
      NEW.id,
      'readiness_status',
      COALESCE(OLD.is_ready::text, 'null'),
      COALESCE(NEW.is_ready::text, 'null'),
      CASE 
        WHEN NEW.is_ready THEN 'Product marked as ready for publication'
        ELSE 'Product marked as not ready for publication'
      END,
      'auto_quality_check'
    );
  END IF;

  -- Log quality score changes
  IF (TG_OP = 'UPDATE' AND OLD.completeness_score IS DISTINCT FROM NEW.completeness_score) THEN
    INSERT INTO quality_change_logs (
      product_id,
      change_type,
      old_value,
      new_value,
      reason,
      triggered_by
    ) VALUES (
      NEW.id,
      'quality_score',
      COALESCE(OLD.completeness_score::text, 'null'),
      COALESCE(NEW.completeness_score::text, 'null'),
      format('Quality score changed from %s%% to %s%%', 
        COALESCE(OLD.completeness_score::text, 'N/A'),
        COALESCE(NEW.completeness_score::text, 'N/A')
      ),
      'auto_quality_check'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log category mapping changes
CREATE OR REPLACE FUNCTION log_category_mapping_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_supplier_category_name text;
  v_internal_category_name text;
  v_products_affected integer;
BEGIN
  -- Get category names
  SELECT name_uk INTO v_supplier_category_name
  FROM supplier_categories
  WHERE id = NEW.supplier_category_id;
  
  SELECT name INTO v_internal_category_name
  FROM internal_categories
  WHERE id = NEW.internal_category_id;

  -- Count affected products
  SELECT COUNT(*) INTO v_products_affected
  FROM products
  WHERE supplier_category_id = NEW.supplier_category_id;

  IF TG_OP = 'INSERT' THEN
    -- Log for each affected product
    INSERT INTO quality_change_logs (
      product_id,
      change_type,
      old_value,
      new_value,
      reason,
      triggered_by
    )
    SELECT 
      p.id,
      'category_mapping',
      null,
      COALESCE(v_internal_category_name, NEW.internal_category_id::text),
      format('Product category mapped: "%s" → "%s" (%s products affected)', 
        COALESCE(v_supplier_category_name, 'Unknown'),
        COALESCE(v_internal_category_name, 'Unknown'),
        v_products_affected
      ),
      'category_mapping'
    FROM products p
    WHERE p.supplier_category_id = NEW.supplier_category_id
    LIMIT 100;
    
  ELSIF TG_OP = 'UPDATE' AND OLD.internal_category_id IS DISTINCT FROM NEW.internal_category_id THEN
    DECLARE
      v_old_internal_category_name text;
    BEGIN
      SELECT name INTO v_old_internal_category_name
      FROM internal_categories
      WHERE id = OLD.internal_category_id;
      
      -- Log for each affected product
      INSERT INTO quality_change_logs (
        product_id,
        change_type,
        old_value,
        new_value,
        reason,
        triggered_by
      )
      SELECT 
        p.id,
        'category_mapping',
        COALESCE(v_old_internal_category_name, OLD.internal_category_id::text),
        COALESCE(v_internal_category_name, NEW.internal_category_id::text),
        format('Category mapping changed: "%s" → "%s" (%s products affected)', 
          COALESCE(v_old_internal_category_name, 'unmapped'),
          COALESCE(v_internal_category_name, 'unmapped'),
          v_products_affected
        ),
        'category_mapping'
      FROM products p
      WHERE p.supplier_category_id = NEW.supplier_category_id
      LIMIT 100;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log significant price changes (>10%)
CREATE OR REPLACE FUNCTION log_price_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_old_price numeric;
  v_new_price numeric;
  v_change_percent numeric;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_old_price := OLD.value;
    v_new_price := NEW.value;
    
    -- Calculate percentage change
    IF v_old_price > 0 THEN
      v_change_percent := ABS((v_new_price - v_old_price) / v_old_price * 100);
      
      -- Only log if change is significant (>10%)
      IF v_change_percent > 10 THEN
        INSERT INTO quality_change_logs (
          product_id,
          change_type,
          old_value,
          new_value,
          reason,
          triggered_by
        ) VALUES (
          NEW.product_id,
          'price_update',
          format('%s %s (%s)', v_old_price, OLD.currency, OLD.price_type),
          format('%s %s (%s)', v_new_price, NEW.currency, NEW.price_type),
          format('%s price changed by %.1f%% (from %s to %s %s)', 
            NEW.price_type,
            v_change_percent,
            v_old_price,
            v_new_price,
            NEW.currency
          ),
          CASE 
            WHEN NEW.source = 'import' THEN 'import'
            ELSE 'manual'
          END
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log stock availability changes
CREATE OR REPLACE FUNCTION log_stock_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_old_total integer;
  v_new_total integer;
  v_old_available boolean;
  v_new_available boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Get old and new totals
    SELECT COALESCE(SUM(quantity), 0) INTO v_old_total
    FROM warehouse_stocks
    WHERE product_id = OLD.product_id AND id != NEW.id;
    v_old_total := v_old_total + COALESCE(OLD.quantity, 0);
    
    SELECT COALESCE(SUM(quantity), 0) INTO v_new_total
    FROM warehouse_stocks
    WHERE product_id = NEW.product_id AND id != NEW.id;
    v_new_total := v_new_total + COALESCE(NEW.quantity, 0);
    
    -- Determine availability status
    v_old_available := v_old_total > 0;
    v_new_available := v_new_total > 0;
    
    -- Log only if availability status changed
    IF v_old_available IS DISTINCT FROM v_new_available THEN
      INSERT INTO quality_change_logs (
        product_id,
        change_type,
        old_value,
        new_value,
        reason,
        triggered_by
      ) VALUES (
        NEW.product_id,
        'stock_update',
        CASE WHEN v_old_available THEN 'In Stock' ELSE 'Out of Stock' END,
        CASE WHEN v_new_available THEN 'In Stock' ELSE 'Out of Stock' END,
        format('Stock availability changed in warehouse "%s": %s → %s (total: %s → %s units)', 
          COALESCE(NEW.warehouse_name, NEW.warehouse_code),
          CASE WHEN v_old_available THEN 'available' ELSE 'unavailable' END,
          CASE WHEN v_new_available THEN 'available' ELSE 'unavailable' END,
          v_old_total,
          v_new_total
        ),
        'import'
      );
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    -- Log when new stock record is created with quantity > 0
    IF COALESCE(NEW.quantity, 0) > 0 THEN
      INSERT INTO quality_change_logs (
        product_id,
        change_type,
        old_value,
        new_value,
        reason,
        triggered_by
      ) VALUES (
        NEW.product_id,
        'stock_update',
        'Out of Stock',
        'In Stock',
        format('Stock added in warehouse "%s": %s units', 
          COALESCE(NEW.warehouse_name, NEW.warehouse_code),
          NEW.quantity
        ),
        'import'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers

-- Trigger for product quality and readiness changes
DROP TRIGGER IF EXISTS trigger_log_product_quality_changes ON products;
CREATE TRIGGER trigger_log_product_quality_changes
  AFTER UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION log_product_quality_changes();

-- Trigger for category mapping changes
DROP TRIGGER IF EXISTS trigger_log_category_mapping_changes ON category_mappings;
CREATE TRIGGER trigger_log_category_mapping_changes
  AFTER INSERT OR UPDATE ON category_mappings
  FOR EACH ROW
  EXECUTE FUNCTION log_category_mapping_changes();

-- Trigger for price changes
DROP TRIGGER IF EXISTS trigger_log_price_changes ON product_prices;
CREATE TRIGGER trigger_log_price_changes
  AFTER UPDATE ON product_prices
  FOR EACH ROW
  EXECUTE FUNCTION log_price_changes();

-- Trigger for stock changes
DROP TRIGGER IF EXISTS trigger_log_stock_changes ON warehouse_stocks;
CREATE TRIGGER trigger_log_stock_changes
  AFTER INSERT OR UPDATE ON warehouse_stocks
  FOR EACH ROW
  EXECUTE FUNCTION log_stock_changes();

-- Grant necessary permissions
GRANT SELECT ON quality_change_logs TO authenticated;
