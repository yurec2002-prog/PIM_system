/*
  # Fix product_prices trigger for DELETE operations

  1. Changes
    - Update trigger function to use OLD.product_id on DELETE
    - Use COALESCE to handle both INSERT/UPDATE and DELETE
*/

CREATE OR REPLACE FUNCTION trigger_calculate_quality_on_price_change()
RETURNS TRIGGER AS $$
BEGIN
  -- On DELETE, use OLD.product_id, otherwise use NEW.product_id
  IF TG_OP = 'DELETE' THEN
    PERFORM calculate_product_quality(OLD.product_id);
    RETURN OLD;
  ELSE
    PERFORM calculate_product_quality(NEW.product_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;