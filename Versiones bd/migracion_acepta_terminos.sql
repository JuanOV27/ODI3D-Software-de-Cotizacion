-- ============================================================
-- Agrega columnas de aceptación de Términos y Condiciones a
-- clientes (idempotente). Registra si el cliente aceptó el
-- documento y la fecha/hora en que lo hizo (Art. 3 de los T&C).
-- ============================================================
SET @existe_col_acepta = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'clientes'
    AND COLUMN_NAME  = 'acepta_terminos'
);

SET @sql_alter_acepta = IF(
  @existe_col_acepta = 0,
  'ALTER TABLE clientes ADD COLUMN acepta_terminos TINYINT(1) NOT NULL DEFAULT 0 AFTER activo',
  'SELECT "columna acepta_terminos ya existe" AS info'
);

PREPARE stmt FROM @sql_alter_acepta;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @existe_col_fecha = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'clientes'
    AND COLUMN_NAME  = 'fecha_aceptacion_terminos'
);

SET @sql_alter_fecha = IF(
  @existe_col_fecha = 0,
  'ALTER TABLE clientes ADD COLUMN fecha_aceptacion_terminos DATETIME NULL AFTER acepta_terminos',
  'SELECT "columna fecha_aceptacion_terminos ya existe" AS info'
);

PREPARE stmt2 FROM @sql_alter_fecha;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;
