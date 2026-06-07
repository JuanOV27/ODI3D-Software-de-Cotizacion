-- ============================================================
-- Agrega columna enlace_whatsapp a productos (idempotente)
-- Permite guardar el enlace directo al producto en el catálogo
-- de WhatsApp (ej: https://wa.me/p/XXXXXXXXXXXXXXX/573147889080)
-- ============================================================
SET @existe_col = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'productos'
    AND COLUMN_NAME  = 'enlace_whatsapp'
);

SET @sql_alter = IF(
  @existe_col = 0,
  'ALTER TABLE productos ADD COLUMN enlace_whatsapp VARCHAR(255) NULL AFTER categoria',
  'SELECT "columna enlace_whatsapp ya existe" AS info'
);

PREPARE stmt FROM @sql_alter;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
