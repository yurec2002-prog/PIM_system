/*
  # Добавление поддержки украинского языка

  ## Изменения

  ### 1. Добавление полей name_uk в internal_categories
    - name_uk - основное название на украинском
    - name сохраняется как русское (для обратной совместимости)

  ### 2. Обновление master_attributes
    - Убедиться что name_uk существует
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'internal_categories' AND column_name = 'name_uk') THEN
    ALTER TABLE internal_categories ADD COLUMN name_uk text;
  END IF;
END $$;

UPDATE internal_categories 
SET name_uk = name 
WHERE name_uk IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'master_attributes' AND column_name = 'name_uk') THEN
    ALTER TABLE master_attributes ADD COLUMN name_uk text;
  END IF;
END $$;

UPDATE master_attributes 
SET name_uk = name 
WHERE name_uk IS NULL AND name IS NOT NULL;
