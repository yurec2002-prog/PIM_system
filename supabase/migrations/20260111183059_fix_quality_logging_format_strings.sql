/*
  # Fix Format Strings in Quality Logging
  
  ## Overview
  Fixes the format() function calls in quality logging triggers to properly escape percent signs.
  
  ## Changes
  - Update log_price_changes() function to use '%%%%' for literal percent signs in format strings
*/

-- Fix the price changes logging function
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
          format('%s price changed by %s%%%% (from %s to %s %s)', 
            NEW.price_type,
            ROUND(v_change_percent, 1),
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
