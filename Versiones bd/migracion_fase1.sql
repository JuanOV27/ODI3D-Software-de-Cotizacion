-- ============================================================
-- MIGRACIÓN FASE 1 — Sistema Integral ODI3D
-- Fecha: 2026-06-04
-- Descripción: Tablas nuevas para auth, catálogo, clientes,
--              solicitudes, chat y pedidos.
--              NO modifica tablas existentes (salvo ALTER final).
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 1. USUARIOS INTERNOS (admin y empleados del taller)
-- ============================================================
CREATE TABLE IF NOT EXISTS `usuarios_internos` (
  `id`             VARCHAR(50)  NOT NULL,
  `nombre`         VARCHAR(100) NOT NULL,
  `email`          VARCHAR(150) NOT NULL,
  `password_hash`  VARCHAR(255) NOT NULL,
  `rol`            ENUM('admin','empleado') NOT NULL DEFAULT 'empleado',
  `activo`         TINYINT(1)   NOT NULL DEFAULT 1,
  `ultimo_acceso`  DATETIME     NULL,
  `fecha_creacion` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Admin por defecto: password = Admin2024!
INSERT IGNORE INTO `usuarios_internos`
  (`id`, `nombre`, `email`, `password_hash`, `rol`)
VALUES (
  CONCAT(UNIX_TIMESTAMP(), '_admin'),
  'Administrador ODI3D',
  'admin@odi3d.com',
  '$2y$12$SHvLXqycaVE5re7FipqxL.TnsrAwhrpeF1A8ce9WWWTIVxu1Hkufi',
  'admin'
);

-- ============================================================
-- 2. MÓDULOS / FEATURE FLAGS
-- ============================================================
CREATE TABLE IF NOT EXISTS `modulos` (
  `nombre`          VARCHAR(50)  NOT NULL,
  `activo`          TINYINT(1)   NOT NULL DEFAULT 1,
  `descripcion`     VARCHAR(200) NULL,
  `mensaje_baja`    VARCHAR(200) NOT NULL DEFAULT 'Módulo en mantenimiento. Intenta más tarde.',
  `fecha_baja`      DATETIME     NULL,
  `desactivado_por` VARCHAR(50)  NULL,
  PRIMARY KEY (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `modulos` (`nombre`, `descripcion`) VALUES
  ('catalogo',    'Catálogo público de productos'),
  ('cotizacion',  'Sistema de cotización técnica'),
  ('solicitudes', 'Solicitudes de cotización de clientes'),
  ('chat',        'Chat con clientes'),
  ('inventario',  'Gestión de inventario'),
  ('metricas',    'Dashboard de métricas financieras');

-- ============================================================
-- 3. CATÁLOGO — productos e imágenes
-- ============================================================
CREATE TABLE IF NOT EXISTS `productos` (
  `id`             VARCHAR(50)    NOT NULL,
  `nombre`         VARCHAR(200)   NOT NULL,
  `descripcion`    TEXT           NULL,
  `precio`         DECIMAL(12,2)  NOT NULL,
  `categoria`      VARCHAR(100)   NULL,
  `visible`        TINYINT(1)     NOT NULL DEFAULT 1,
  `fecha_creacion` DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `creado_por`     VARCHAR(50)    NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `productos_imagenes` (
  `id`          VARCHAR(50)  NOT NULL,
  `producto_id` VARCHAR(50)  NOT NULL,
  `ruta`        VARCHAR(500) NOT NULL,
  `orden`       INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_producto` (`producto_id`),
  CONSTRAINT `fk_img_producto`
    FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. RESEÑAS DE PRODUCTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS `reviews` (
  `id`          VARCHAR(50) NOT NULL,
  `producto_id` VARCHAR(50) NOT NULL,
  `cliente_id`  VARCHAR(50) NOT NULL,
  `calificacion` TINYINT   NOT NULL CHECK (`calificacion` BETWEEN 1 AND 5),
  `comentario`  TEXT        NULL,
  `aprobado`    TINYINT(1)  NOT NULL DEFAULT 0,
  `fecha`       DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rev_producto` (`producto_id`),
  CONSTRAINT `fk_rev_producto`
    FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. CLIENTES (sistema público / tienda)
-- ============================================================
CREATE TABLE IF NOT EXISTS `clientes` (
  `id`                  VARCHAR(50)  NOT NULL,
  `nombre`              VARCHAR(150) NOT NULL,
  `email`               VARCHAR(150) NOT NULL,
  `password_hash`       VARCHAR(255) NOT NULL,
  `telefono`            VARCHAR(20)  NULL,
  `activo`              TINYINT(1)   NOT NULL DEFAULT 1,
  `email_verificado`    TINYINT(1)   NOT NULL DEFAULT 0,
  `token_verificacion`  VARCHAR(100) NULL,
  `intentos_login`      INT          NOT NULL DEFAULT 0,
  `bloqueado_hasta`     DATETIME     NULL,
  `fecha_registro`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultimo_acceso`       DATETIME     NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cliente_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. SOLICITUDES DE COTIZACIÓN PERSONALIZADAS
-- ============================================================
CREATE TABLE IF NOT EXISTS `solicitudes_cotizacion` (
  `id`              VARCHAR(50)  NOT NULL,
  `cliente_id`      VARCHAR(50)  NOT NULL,
  `descripcion`     TEXT         NOT NULL,
  `estado`          ENUM('recibida','en_proceso','cotizada','aceptada',
                         'rechazada','en_produccion','entregada')
                    NOT NULL DEFAULT 'recibida',
  `precio_final`    DECIMAL(12,2) NULL,
  `notas_internas`  TEXT         NULL,
  `cotizacion_id`   VARCHAR(50)  NULL,
  `asignado_a`      VARCHAR(50)  NULL,
  `fecha_solicitud` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_respuesta` DATETIME     NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sol_cliente` (`cliente_id`),
  KEY `idx_sol_estado` (`estado`),
  CONSTRAINT `fk_sol_cliente`
    FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`),
  CONSTRAINT `fk_sol_cotizacion`
    FOREIGN KEY (`cotizacion_id`) REFERENCES `cotizaciones` (`id`)
    ON DELETE SET NULL,
  CONSTRAINT `fk_sol_asignado`
    FOREIGN KEY (`asignado_a`) REFERENCES `usuarios_internos` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `solicitudes_archivos` (
  `id`               VARCHAR(50)  NOT NULL,
  `solicitud_id`     VARCHAR(50)  NOT NULL,
  `nombre_original`  VARCHAR(300) NOT NULL,
  `nombre_servidor`  VARCHAR(300) NOT NULL,
  `tipo_mime`        VARCHAR(100) NULL,
  `tamano_bytes`     INT          NULL,
  PRIMARY KEY (`id`),
  KEY `idx_arch_solicitud` (`solicitud_id`),
  CONSTRAINT `fk_arch_solicitud`
    FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes_cotizacion` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. CHAT INTERNO (por solicitud)
-- ============================================================
CREATE TABLE IF NOT EXISTS `chat_mensajes` (
  `id`           VARCHAR(50)            NOT NULL,
  `solicitud_id` VARCHAR(50)            NOT NULL,
  `remitente`    ENUM('cliente','empleado') NOT NULL,
  `remitente_id` VARCHAR(50)            NOT NULL,
  `mensaje`      TEXT                   NOT NULL,
  `leido`        TINYINT(1)             NOT NULL DEFAULT 0,
  `fecha`        DATETIME               NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_chat_solicitud` (`solicitud_id`),
  KEY `idx_chat_leido` (`leido`),
  CONSTRAINT `fk_chat_solicitud`
    FOREIGN KEY (`solicitud_id`) REFERENCES `solicitudes_cotizacion` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8. PEDIDOS DEL CATÁLOGO (vía WhatsApp — sin checkout interno)
-- ============================================================
CREATE TABLE IF NOT EXISTS `pedidos` (
  `id`               VARCHAR(50)  NOT NULL,
  `cliente_id`       VARCHAR(50)  NOT NULL,
  `estado`           ENUM('pendiente','confirmado','cancelado') NOT NULL DEFAULT 'pendiente',
  `total`            DECIMAL(12,2) NOT NULL,
  `whatsapp_enviado` TINYINT(1)   NOT NULL DEFAULT 0,
  `fecha`            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ped_cliente` (`cliente_id`),
  CONSTRAINT `fk_ped_cliente`
    FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pedidos_items` (
  `id`              VARCHAR(50)   NOT NULL,
  `pedido_id`       VARCHAR(50)   NOT NULL,
  `producto_id`     VARCHAR(50)   NOT NULL,
  `cantidad`        INT           NOT NULL DEFAULT 1,
  `precio_unitario` DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_item_pedido` (`pedido_id`),
  CONSTRAINT `fk_item_pedido`
    FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_item_producto`
    FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 9. EXTENDER COTIZACIONES — columna solicitud_id (idempotente)
-- ============================================================
-- Usar SET para no fallar si ya existe la columna
SET @existe_col = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'cotizaciones'
    AND COLUMN_NAME  = 'solicitud_id'
);

SET @sql_alter = IF(
  @existe_col = 0,
  'ALTER TABLE cotizaciones ADD COLUMN solicitud_id VARCHAR(50) NULL AFTER id',
  'SELECT "columna solicitud_id ya existe" AS info'
);

PREPARE stmt FROM @sql_alter;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- FK solo si la columna acaba de ser creada y no existe la FK
SET @existe_fk = (
  SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA   = DATABASE()
    AND TABLE_NAME     = 'cotizaciones'
    AND CONSTRAINT_NAME = 'fk_cot_solicitud'
);

SET @sql_fk = IF(
  @existe_fk = 0 AND @existe_col = 0,
  'ALTER TABLE cotizaciones ADD CONSTRAINT fk_cot_solicitud FOREIGN KEY (solicitud_id) REFERENCES solicitudes_cotizacion (id) ON DELETE SET NULL',
  'SELECT "FK fk_cot_solicitud ya existe o columna preexistente" AS info'
);

PREPARE stmt2 FROM @sql_fk;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- FIN DE MIGRACIÓN
-- Para ejecutar: importar en phpMyAdmin o via mysql CLI:
--   mysql -u root -P 3307 sistema_gestion_3d < migracion_fase1.sql
-- ============================================================
