/*
  # Fix Manual Override Function

  1. Changes
    - Removes ON CONFLICT clause that referenced non-existent constraint
    - Uses simpler upsert logic
*/

CREATE OR REPLACE FUNCTION set_manual_override(
  p_internal_sku_id uuid,
  p_master_attr_id uuid,
  p_value text,
  p_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_value_id uuid;
  v_sandi_supplier_id uuid;
  v_existing_manual_id uuid;
BEGIN
  -- Get Sandi supplier ID (for source tracking)
  SELECT id INTO v_sandi_supplier_id
  FROM suppliers
  WHERE code = 'sandi' OR LOWER(name) LIKE '%sandi%'
  LIMIT 1;
  
  -- Check if manual override already exists
  SELECT id INTO v_existing_manual_id
  FROM sku_attribute_values
  WHERE internal_sku_id = p_internal_sku_id
    AND master_attr_id = p_master_attr_id
    AND is_manual_override = true;
  
  IF v_existing_manual_id IS NOT NULL THEN
    -- Update existing manual override
    UPDATE sku_attribute_values
    SET 
      value = p_value,
      value_normalized = p_value,
      is_active = true,
      updated_at = now()
    WHERE id = v_existing_manual_id
    RETURNING id INTO v_value_id;
  ELSE
    -- Create new manual override
    INSERT INTO sku_attribute_values (
      internal_sku_id,
      master_attr_id,
      value,
      value_normalized,
      source_supplier_id,
      source_type,
      is_active,
      is_manual_override,
      priority_score
    ) VALUES (
      p_internal_sku_id,
      p_master_attr_id,
      p_value,
      p_value,
      v_sandi_supplier_id,
      'manual',
      true,
      true,
      90
    )
    RETURNING id INTO v_value_id;
  END IF;
  
  -- Deactivate all other values
  UPDATE sku_attribute_values
  SET is_active = false
  WHERE internal_sku_id = p_internal_sku_id
    AND master_attr_id = p_master_attr_id
    AND id != v_value_id;
  
  RETURN v_value_id;
END;
$$;
