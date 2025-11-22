-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1:3307
-- Tiempo de generación: 06-11-2025 a las 14:56:18
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `sistema_gestion_3d`
--

DELIMITER $$
--
-- Procedimientos
--
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_estadisticas_inventario` ()   BEGIN
    SELECT 
        COUNT(*) AS total_carretes,
        SUM(CASE WHEN estado = 'activo' THEN 1 ELSE 0 END) AS carretes_activos,
        SUM(peso_inicial) AS peso_total_inicial,
        SUM(peso_usado) AS peso_total_usado,
        SUM(peso_restante) AS peso_total_restante,
        ROUND(AVG(porcentaje_restante), 2) AS porcentaje_restante_promedio,
        COUNT(CASE WHEN porcentaje_restante < 20 AND estado = 'activo' THEN 1 END) AS carretes_bajo_stock
    FROM inventario_carretes;
END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_registrar_uso_filamento` (IN `p_carrete_id` VARCHAR(50), IN `p_gramos_usados` DECIMAL(10,2), IN `p_nombre_proyecto` VARCHAR(200))   BEGIN
    DECLARE v_perfil_id VARCHAR(50);
    DECLARE v_peso_restante_anterior DECIMAL(10,2);
    DECLARE v_peso_restante_actual DECIMAL(10,2);
    DECLARE v_uso_id VARCHAR(50);
    
    -- Obtener datos del carrete
    SELECT perfil_id, peso_restante INTO v_perfil_id, v_peso_restante_anterior
    FROM inventario_carretes
    WHERE id = p_carrete_id;
    
    -- Validar que hay suficiente filamento
    IF v_peso_restante_anterior < p_gramos_usados THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'No hay suficiente filamento en el carrete';
    END IF;
    
    -- Calcular peso restante actual
    SET v_peso_restante_actual = v_peso_restante_anterior - p_gramos_usados;
    
    -- Generar ID único
    SET v_uso_id = CONCAT(UNIX_TIMESTAMP(), '_', SUBSTRING(MD5(RAND()), 1, 9));
    
    -- Actualizar carrete
    UPDATE inventario_carretes
    SET peso_usado = peso_usado + p_gramos_usados
    WHERE id = p_carrete_id;
    
    -- Cambiar estado si se agotó
    IF v_peso_restante_actual <= 0 THEN
        UPDATE inventario_carretes
        SET estado = 'agotado'
        WHERE id = p_carrete_id;
    END IF;
    
    -- Registrar en historial
    INSERT INTO historial_uso (
        id, carrete_id, perfil_id, gramos_usados,
        peso_restante_anterior, peso_restante_actual, nombre_proyecto
    ) VALUES (
        v_uso_id, p_carrete_id, v_perfil_id, p_gramos_usados,
        v_peso_restante_anterior, v_peso_restante_actual, p_nombre_proyecto
    );
    
    SELECT v_uso_id AS id, 'Uso registrado exitosamente' AS mensaje;
END$$

DELIMITER ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `calculos_cotizacion`
--

CREATE TABLE `calculos_cotizacion` (
  `cotizacion_id` varchar(50) NOT NULL,
  `costo_fabricacion` decimal(10,2) NOT NULL,
  `costo_energia` decimal(10,2) NOT NULL,
  `costo_diseno` decimal(10,2) NOT NULL,
  `depreciacion_maquina` decimal(10,2) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `costo_gif` decimal(10,2) NOT NULL,
  `costo_aiu` decimal(10,2) NOT NULL,
  `costo_marca_agua` decimal(10,2) DEFAULT 0.00,
  `precio_final` decimal(10,2) NOT NULL,
  `precio_minorista` decimal(10,2) NOT NULL,
  `precio_mayorista` decimal(10,2) NOT NULL,
  `numero_lotes` int(11) NOT NULL,
  `costo_por_lote` decimal(10,2) NOT NULL,
  `costo_total_pedido` decimal(10,2) NOT NULL,
  `tiempo_total_minutos` decimal(10,2) NOT NULL,
  `tiempo_total_horas` decimal(10,2) NOT NULL,
  `filamento_total_gramos` decimal(10,2) NOT NULL,
  `costo_electrico_total` decimal(10,2) NOT NULL,
  `costo_total_pedido_minorista` decimal(10,2) NOT NULL,
  `costo_total_pedido_mayorista` decimal(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `calculos_cotizacion`
--

INSERT INTO `calculos_cotizacion` (`cotizacion_id`, `costo_fabricacion`, `costo_energia`, `costo_diseno`, `depreciacion_maquina`, `subtotal`, `costo_gif`, `costo_aiu`, `costo_marca_agua`, `precio_final`, `precio_minorista`, `precio_mayorista`, `numero_lotes`, `costo_por_lote`, `costo_total_pedido`, `tiempo_total_minutos`, `tiempo_total_horas`, `filamento_total_gramos`, `costo_electrico_total`, `costo_total_pedido_minorista`, `costo_total_pedido_mayorista`) VALUES
('1762401552_cd485fbdd', 6006.00, 1980.00, 10000.00, 7583.33, 25569.33, 3835.40, 7351.18, 0.00, 36755.92, 47782.69, 44107.10, 5, 36755.92, 183779.58, 900.00, 15.00, 227.50, 9000.00, 238913.46, 220535.50),
('1762402645_2c180bbfa', 6600.00, 1320.00, 50000.00, 8333.33, 66253.33, 9938.00, 19047.83, 0.00, 95239.17, 123810.92, 114287.00, 1, 95239.17, 95239.17, 120.00, 2.00, 50.00, 1200.00, 123810.92, 114287.00),
('1762402654_e3e3e6b64', 6600.00, 1320.00, 50000.00, 8333.33, 66253.33, 9938.00, 19047.83, 0.00, 95239.17, 123810.92, 114287.00, 1, 95239.17, 95239.17, 120.00, 2.00, 50.00, 1200.00, 123810.92, 114287.00),
('1762403714_a7266509d', 6600.00, 1320.00, 50000.00, 8333.33, 66253.33, 9938.00, 19047.83, 0.00, 95239.17, 123810.92, 114287.00, 1, 95239.17, 95239.17, 120.00, 2.00, 50.00, 1200.00, 123810.92, 114287.00),
('1762404008_ac66b0267', 976.80, 440.00, 50000.00, 1233.33, 52650.13, 7897.52, 15136.91, 0.00, 75684.57, 98389.94, 90821.48, 1, 75684.57, 75684.57, 40.00, 0.70, 7.40, 400.00, 98389.94, 90821.48),
('1762404048_e36a25aa5', 1332.00, 600.00, 0.00, 1233.33, 3165.33, 474.80, 910.03, 0.00, 4550.17, 5915.22, 5460.20, 1, 4550.17, 4550.17, 40.00, 0.70, 7.40, 400.00, 5915.22, 5460.20),
('1762404229_d67daaec0', 2112.00, 473.00, 50000.00, 2666.67, 55251.67, 8287.75, 15884.85, 0.00, 79424.27, 103251.55, 95309.13, 1, 79424.27, 79424.27, 43.00, 0.70, 16.00, 430.00, 103251.55, 95309.13),
('1762437173_b1250b662', 2112.00, 473.00, 50000.00, 2666.67, 55251.67, 8287.75, 15884.85, 0.00, 79424.27, 103251.55, 95309.13, 1, 79424.27, 79424.27, 43.00, 0.70, 16.00, 430.00, 103251.55, 95309.13);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `configuracion`
--

CREATE TABLE `configuracion` (
  `id` int(11) NOT NULL,
  `clave` varchar(100) NOT NULL,
  `valor` text NOT NULL,
  `tipo` enum('numero','texto','json','booleano') DEFAULT 'texto',
  `descripcion` text DEFAULT NULL,
  `fecha_modificacion` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `configuracion`
--

INSERT INTO `configuracion` (`id`, `clave`, `valor`, `tipo`, `descripcion`, `fecha_modificacion`) VALUES
(1, 'version_sistema', '5.0', 'texto', 'Versión del sistema', '2025-11-05 17:37:38'),
(2, 'factor_seguridad', '1.1', 'numero', 'Factor de seguridad para cálculos', '2025-11-05 17:37:38'),
(3, 'uso_electricidad', '600', 'numero', 'Costo de electricidad por hora (COP)', '2025-11-05 17:37:38'),
(4, 'gif', '15', 'numero', 'Porcentaje de GIF', '2025-11-05 17:37:38'),
(5, 'aiu', '25', 'numero', 'Porcentaje de AIU', '2025-11-05 17:37:38'),
(6, 'margen_minorista', '30', 'numero', 'Margen de venta minorista (%)', '2025-11-05 17:37:38'),
(7, 'margen_mayorista', '20', 'numero', 'Margen de venta mayorista (%)', '2025-11-05 17:37:38'),
(8, 'costo_hora_diseno', '25000', 'numero', 'Costo por hora de diseño (COP)', '2025-11-05 17:37:38'),
(9, 'depreciacion_costo_inicial', '1400000', 'numero', 'Costo inicial de la máquina', '2025-11-05 17:37:38'),
(10, 'depreciacion_valor_residual', '0.1', 'numero', 'Valor residual de la máquina', '2025-11-05 17:37:38'),
(11, 'depreciacion_vida_util', '3', 'numero', 'Vida útil de la máquina (años)', '2025-11-05 17:37:38'),
(12, 'depreciacion_horas_mensuales', '210', 'numero', 'Horas de uso mensual estimadas', '2025-11-05 17:37:38');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `cotizaciones`
--

CREATE TABLE `cotizaciones` (
  `id` varchar(50) NOT NULL,
  `nombre_pieza` varchar(200) NOT NULL,
  `perfil_filamento_id` varchar(50) DEFAULT NULL,
  `carrete_id` varchar(50) DEFAULT NULL,
  `peso_pieza` decimal(10,2) NOT NULL COMMENT 'Peso en gramos',
  `tiempo_impresion` decimal(10,2) NOT NULL COMMENT 'Tiempo en minutos',
  `cantidad_piezas` int(11) NOT NULL DEFAULT 1,
  `piezas_por_lote` int(11) NOT NULL DEFAULT 1,
  `costo_carrete` decimal(10,2) NOT NULL,
  `peso_carrete` decimal(10,2) NOT NULL COMMENT 'Peso en kg',
  `horas_diseno` decimal(10,2) DEFAULT 0.00,
  `costo_hora_diseno` decimal(10,2) NOT NULL,
  `factor_seguridad` decimal(5,2) NOT NULL DEFAULT 1.10,
  `uso_electricidad` decimal(10,2) NOT NULL COMMENT 'Costo por hora en COP',
  `gif` decimal(5,2) NOT NULL COMMENT 'Porcentaje GIF',
  `aiu` decimal(5,2) NOT NULL COMMENT 'Porcentaje AIU',
  `incluir_marca_agua` tinyint(1) DEFAULT 0,
  `porcentaje_marca_agua` decimal(5,2) DEFAULT 0.00,
  `margen_minorista` decimal(5,2) NOT NULL,
  `margen_mayorista` decimal(5,2) NOT NULL,
  `fecha` date NOT NULL,
  `fecha_completa` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `cotizaciones`
--

INSERT INTO `cotizaciones` (`id`, `nombre_pieza`, `perfil_filamento_id`, `carrete_id`, `peso_pieza`, `tiempo_impresion`, `cantidad_piezas`, `piezas_por_lote`, `costo_carrete`, `peso_carrete`, `horas_diseno`, `costo_hora_diseno`, `factor_seguridad`, `uso_electricidad`, `gif`, `aiu`, `incluir_marca_agua`, `porcentaje_marca_agua`, `margen_minorista`, `margen_mayorista`, `fecha`, `fecha_completa`) VALUES
('1762401552_cd485fbdd', 'Soporte para Monitor', NULL, NULL, 45.50, 180.00, 5, 1, 120000.00, 1.00, 2.00, 25000.00, 1.10, 600.00, 15.00, 25.00, 0, 0.00, 30.00, 20.00, '2025-11-05', '2025-11-05 22:59:12'),
('1762402645_2c180bbfa', 'Pieza sin nombre', NULL, NULL, 50.00, 120.00, 1, 1, 120000.00, 1.00, 2.00, 25000.00, 1.10, 600.00, 15.00, 25.00, 0, 10.00, 30.00, 20.00, '2025-11-05', '2025-11-05 23:17:25'),
('1762402654_e3e3e6b64', 'Morrocoy', NULL, NULL, 50.00, 120.00, 1, 1, 120000.00, 1.00, 2.00, 25000.00, 1.10, 600.00, 15.00, 25.00, 0, 10.00, 30.00, 20.00, '2025-11-05', '2025-11-05 23:17:34'),
('1762403714_a7266509d', 'Pieza sin nombre', NULL, NULL, 50.00, 120.00, 1, 1, 120000.00, 1.00, 2.00, 25000.00, 1.10, 600.00, 15.00, 25.00, 0, 10.00, 30.00, 20.00, '2025-11-05', '2025-11-05 23:35:14'),
('1762404008_ac66b0267', 'Pieza sin nombre', NULL, NULL, 7.40, 40.00, 1, 1, 120000.00, 1.00, 2.00, 25000.00, 1.10, 600.00, 15.00, 25.00, 0, 10.00, 30.00, 20.00, '2025-11-05', '2025-11-05 23:40:08'),
('1762404048_e36a25aa5', 'Cubo simple', NULL, NULL, 7.40, 40.00, 1, 1, 120000.00, 1.00, 0.00, 25000.00, 1.50, 600.00, 15.00, 25.00, 0, 10.00, 30.00, 20.00, '2025-11-05', '2025-11-05 23:40:48'),
('1762404229_d67daaec0', 'Cubo simple', NULL, NULL, 16.00, 43.00, 1, 1, 120000.00, 1.00, 2.00, 25000.00, 1.10, 600.00, 15.00, 25.00, 0, 0.00, 30.00, 20.00, '2025-11-05', '2025-11-05 23:43:49'),
('1762437173_b1250b662', 'Cubo simple', NULL, NULL, 16.00, 43.00, 1, 1, 120000.00, 1.00, 2.00, 25000.00, 1.10, 600.00, 15.00, 25.00, 0, 0.00, 30.00, 20.00, '2025-11-06', '2025-11-06 08:52:53');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `historial_uso`
--

CREATE TABLE `historial_uso` (
  `id` varchar(50) NOT NULL,
  `carrete_id` varchar(50) NOT NULL,
  `perfil_id` varchar(50) NOT NULL,
  `gramos_usados` decimal(10,2) NOT NULL,
  `peso_restante_anterior` decimal(10,2) NOT NULL,
  `peso_restante_actual` decimal(10,2) NOT NULL,
  `nombre_proyecto` varchar(200) DEFAULT NULL,
  `fecha_hora` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `historial_uso`
--

INSERT INTO `historial_uso` (`id`, `carrete_id`, `perfil_id`, `gramos_usados`, `peso_restante_anterior`, `peso_restante_actual`, `nombre_proyecto`, `fecha_hora`) VALUES
('1762403542_c613a95a4', '1762401545_570d4abb7', '1762401542_68aa21fbf', 39.00, 1000.00, 961.00, '', '2025-11-05 23:32:22'),
('1762403599_f4350dfda', '1762401590_2cf516597', '1762401585_b1a2ca463', 75.00, 1000.00, 925.00, '', '2025-11-05 23:33:19'),
('1762403609_4b98bb2b6', '1762403322_1c7e00aa7', '1762403316_a282007f1', 20.00, 1000.00, 980.00, '', '2025-11-05 23:33:29'),
('1762403643_827b78baa', '1762403322_1c7e00aa7', '1762403316_a282007f1', 123.00, 980.00, 857.00, '', '2025-11-05 23:34:03');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `inventario_carretes`
--

CREATE TABLE `inventario_carretes` (
  `id` varchar(50) NOT NULL,
  `perfil_id` varchar(50) NOT NULL,
  `peso_inicial` decimal(10,2) NOT NULL COMMENT 'Peso inicial en gramos',
  `peso_usado` decimal(10,2) DEFAULT 0.00 COMMENT 'Peso usado en gramos',
  `estado` enum('activo','agotado','pausado') DEFAULT 'activo',
  `fecha_creacion` datetime DEFAULT current_timestamp(),
  `fecha_modificacion` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `peso_restante` decimal(10,2) GENERATED ALWAYS AS (`peso_inicial` - `peso_usado`) STORED,
  `porcentaje_restante` decimal(5,2) GENERATED ALWAYS AS ((`peso_inicial` - `peso_usado`) / `peso_inicial` * 100) STORED
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `inventario_carretes`
--

INSERT INTO `inventario_carretes` (`id`, `perfil_id`, `peso_inicial`, `peso_usado`, `estado`, `fecha_creacion`, `fecha_modificacion`) VALUES
('1762401537_9163256e3', '1762401518_a4ff01eca', 1000.00, 0.00, 'activo', '2025-11-05 22:58:57', '2025-11-05 22:58:57'),
('1762401545_570d4abb7', '1762401542_68aa21fbf', 1000.00, 39.00, 'activo', '2025-11-05 22:59:05', '2025-11-05 23:32:22'),
('1762401590_2cf516597', '1762401585_b1a2ca463', 1000.00, 75.00, 'activo', '2025-11-05 22:59:50', '2025-11-05 23:33:19'),
('1762403322_1c7e00aa7', '1762403316_a282007f1', 1000.00, 143.00, 'activo', '2025-11-05 23:28:42', '2025-11-05 23:34:03');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `perfiles_filamento`
--

CREATE TABLE `perfiles_filamento` (
  `id` varchar(50) NOT NULL,
  `tipo` varchar(20) NOT NULL,
  `marca` varchar(100) NOT NULL,
  `color_nombre` varchar(50) NOT NULL,
  `color_codigo` varchar(7) NOT NULL,
  `peso` decimal(5,2) NOT NULL COMMENT 'Peso en kg',
  `costo` decimal(10,2) NOT NULL COMMENT 'Costo en COP',
  `temperatura` int(11) DEFAULT NULL COMMENT 'Temperatura en °C',
  `calidad` tinyint(4) DEFAULT 0 COMMENT 'Calificación de 0-5 estrellas',
  `calidad_nota` text DEFAULT NULL,
  `fecha_compra` date DEFAULT NULL,
  `fecha_creacion` datetime DEFAULT current_timestamp(),
  `costo_por_gramo` decimal(10,6) GENERATED ALWAYS AS (`costo` / (`peso` * 1000)) STORED
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `perfiles_filamento`
--

INSERT INTO `perfiles_filamento` (`id`, `tipo`, `marca`, `color_nombre`, `color_codigo`, `peso`, `costo`, `temperatura`, `calidad`, `calidad_nota`, `fecha_compra`, `fecha_creacion`) VALUES
('1762401518_a4ff01eca', 'PLA', 'eSun', 'Rojo', '#FF0000', 1.00, 120000.00, 210, 5, 'Excelente calidad, muy recomendado', '2025-11-05', '2025-11-05 22:58:38'),
('1762401542_68aa21fbf', 'ABS', 'Sunlu', 'Negro', '#000000', 1.00, 135000.00, 240, 4, 'Buena resistencia térmica', '2025-11-05', '2025-11-05 22:59:02'),
('1762401585_b1a2ca463', 'PETG', 'Overture', 'Azul Transparente', '#0080FF', 1.00, 145000.00, 230, 5, 'Perfecto para piezas funcionales', '2025-11-05', '2025-11-05 22:59:45'),
('1762403316_a282007f1', 'PETG', 'Fill3D', 'Rojo escarlata', '#f61e1e', 1.00, 80000.00, 240, 5, 'Presenta buena calidad', '2025-11-06', '2025-11-05 23:28:36');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `perfiles_proyecto`
--

CREATE TABLE `perfiles_proyecto` (
  `id` varchar(50) NOT NULL,
  `nombre` varchar(200) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `perfil_filamento_id` varchar(50) DEFAULT NULL,
  `peso_pieza` decimal(10,2) DEFAULT NULL,
  `tiempo_impresion` decimal(10,2) DEFAULT NULL,
  `horas_diseno` decimal(10,2) DEFAULT NULL,
  `fecha_creacion` datetime DEFAULT current_timestamp(),
  `fecha_modificacion` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura Stand-in para la vista `vista_cotizaciones_completas`
-- (Véase abajo para la vista actual)
--
CREATE TABLE `vista_cotizaciones_completas` (
`id` varchar(50)
,`nombre_pieza` varchar(200)
,`perfil_filamento_id` varchar(50)
,`carrete_id` varchar(50)
,`peso_pieza` decimal(10,2)
,`tiempo_impresion` decimal(10,2)
,`cantidad_piezas` int(11)
,`piezas_por_lote` int(11)
,`costo_carrete` decimal(10,2)
,`peso_carrete` decimal(10,2)
,`horas_diseno` decimal(10,2)
,`costo_hora_diseno` decimal(10,2)
,`factor_seguridad` decimal(5,2)
,`uso_electricidad` decimal(10,2)
,`gif` decimal(5,2)
,`aiu` decimal(5,2)
,`incluir_marca_agua` tinyint(1)
,`porcentaje_marca_agua` decimal(5,2)
,`margen_minorista` decimal(5,2)
,`margen_mayorista` decimal(5,2)
,`fecha` date
,`fecha_completa` datetime
,`precio_final` decimal(10,2)
,`precio_minorista` decimal(10,2)
,`precio_mayorista` decimal(10,2)
,`costo_total_pedido` decimal(10,2)
,`tiempo_total_horas` decimal(10,2)
,`filamento_total_gramos` decimal(10,2)
,`tipo_filamento` varchar(20)
,`marca_filamento` varchar(100)
,`color_filamento` varchar(50)
);

-- --------------------------------------------------------

--
-- Estructura Stand-in para la vista `vista_estadisticas_uso`
-- (Véase abajo para la vista actual)
--
CREATE TABLE `vista_estadisticas_uso` (
`tipo` varchar(20)
,`marca` varchar(100)
,`color_nombre` varchar(50)
,`carretes_usados` bigint(21)
,`total_gramos_usados` decimal(32,2)
,`total_usos` bigint(21)
,`promedio_gramos_por_uso` decimal(14,6)
,`ultimo_uso` datetime
);

-- --------------------------------------------------------

--
-- Estructura Stand-in para la vista `vista_inventario_detallado`
-- (Véase abajo para la vista actual)
--
CREATE TABLE `vista_inventario_detallado` (
`carrete_id` varchar(50)
,`peso_inicial` decimal(10,2)
,`peso_usado` decimal(10,2)
,`peso_restante` decimal(10,2)
,`porcentaje_restante` decimal(5,2)
,`estado` enum('activo','agotado','pausado')
,`fecha_creacion` datetime
,`perfil_id` varchar(50)
,`tipo` varchar(20)
,`marca` varchar(100)
,`color_nombre` varchar(50)
,`color_codigo` varchar(7)
,`peso_carrete_kg` decimal(5,2)
,`costo_carrete` decimal(10,2)
,`costo_por_gramo` decimal(10,6)
,`calidad` tinyint(4)
,`temperatura` int(11)
);

-- --------------------------------------------------------

--
-- Estructura para la vista `vista_cotizaciones_completas`
--
DROP TABLE IF EXISTS `vista_cotizaciones_completas`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `vista_cotizaciones_completas`  AS SELECT `c`.`id` AS `id`, `c`.`nombre_pieza` AS `nombre_pieza`, `c`.`perfil_filamento_id` AS `perfil_filamento_id`, `c`.`carrete_id` AS `carrete_id`, `c`.`peso_pieza` AS `peso_pieza`, `c`.`tiempo_impresion` AS `tiempo_impresion`, `c`.`cantidad_piezas` AS `cantidad_piezas`, `c`.`piezas_por_lote` AS `piezas_por_lote`, `c`.`costo_carrete` AS `costo_carrete`, `c`.`peso_carrete` AS `peso_carrete`, `c`.`horas_diseno` AS `horas_diseno`, `c`.`costo_hora_diseno` AS `costo_hora_diseno`, `c`.`factor_seguridad` AS `factor_seguridad`, `c`.`uso_electricidad` AS `uso_electricidad`, `c`.`gif` AS `gif`, `c`.`aiu` AS `aiu`, `c`.`incluir_marca_agua` AS `incluir_marca_agua`, `c`.`porcentaje_marca_agua` AS `porcentaje_marca_agua`, `c`.`margen_minorista` AS `margen_minorista`, `c`.`margen_mayorista` AS `margen_mayorista`, `c`.`fecha` AS `fecha`, `c`.`fecha_completa` AS `fecha_completa`, `cc`.`precio_final` AS `precio_final`, `cc`.`precio_minorista` AS `precio_minorista`, `cc`.`precio_mayorista` AS `precio_mayorista`, `cc`.`costo_total_pedido` AS `costo_total_pedido`, `cc`.`tiempo_total_horas` AS `tiempo_total_horas`, `cc`.`filamento_total_gramos` AS `filamento_total_gramos`, `pf`.`tipo` AS `tipo_filamento`, `pf`.`marca` AS `marca_filamento`, `pf`.`color_nombre` AS `color_filamento` FROM ((`cotizaciones` `c` left join `calculos_cotizacion` `cc` on(`c`.`id` = `cc`.`cotizacion_id`)) left join `perfiles_filamento` `pf` on(`c`.`perfil_filamento_id` = `pf`.`id`)) ;

-- --------------------------------------------------------

--
-- Estructura para la vista `vista_estadisticas_uso`
--
DROP TABLE IF EXISTS `vista_estadisticas_uso`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `vista_estadisticas_uso`  AS SELECT `pf`.`tipo` AS `tipo`, `pf`.`marca` AS `marca`, `pf`.`color_nombre` AS `color_nombre`, count(distinct `hu`.`carrete_id`) AS `carretes_usados`, sum(`hu`.`gramos_usados`) AS `total_gramos_usados`, count(`hu`.`id`) AS `total_usos`, avg(`hu`.`gramos_usados`) AS `promedio_gramos_por_uso`, max(`hu`.`fecha_hora`) AS `ultimo_uso` FROM (`historial_uso` `hu` join `perfiles_filamento` `pf` on(`hu`.`perfil_id` = `pf`.`id`)) GROUP BY `pf`.`id`, `pf`.`tipo`, `pf`.`marca`, `pf`.`color_nombre` ;

-- --------------------------------------------------------

--
-- Estructura para la vista `vista_inventario_detallado`
--
DROP TABLE IF EXISTS `vista_inventario_detallado`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `vista_inventario_detallado`  AS SELECT `ic`.`id` AS `carrete_id`, `ic`.`peso_inicial` AS `peso_inicial`, `ic`.`peso_usado` AS `peso_usado`, `ic`.`peso_restante` AS `peso_restante`, `ic`.`porcentaje_restante` AS `porcentaje_restante`, `ic`.`estado` AS `estado`, `ic`.`fecha_creacion` AS `fecha_creacion`, `pf`.`id` AS `perfil_id`, `pf`.`tipo` AS `tipo`, `pf`.`marca` AS `marca`, `pf`.`color_nombre` AS `color_nombre`, `pf`.`color_codigo` AS `color_codigo`, `pf`.`peso` AS `peso_carrete_kg`, `pf`.`costo` AS `costo_carrete`, `pf`.`costo_por_gramo` AS `costo_por_gramo`, `pf`.`calidad` AS `calidad`, `pf`.`temperatura` AS `temperatura` FROM (`inventario_carretes` `ic` join `perfiles_filamento` `pf` on(`ic`.`perfil_id` = `pf`.`id`)) ;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `calculos_cotizacion`
--
ALTER TABLE `calculos_cotizacion`
  ADD PRIMARY KEY (`cotizacion_id`);

--
-- Indices de la tabla `configuracion`
--
ALTER TABLE `configuracion`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `clave` (`clave`);

--
-- Indices de la tabla `cotizaciones`
--
ALTER TABLE `cotizaciones`
  ADD PRIMARY KEY (`id`),
  ADD KEY `perfil_filamento_id` (`perfil_filamento_id`),
  ADD KEY `carrete_id` (`carrete_id`),
  ADD KEY `idx_fecha` (`fecha`),
  ADD KEY `idx_nombre` (`nombre_pieza`),
  ADD KEY `idx_cotizacion_fecha_nombre` (`fecha`,`nombre_pieza`);

--
-- Indices de la tabla `historial_uso`
--
ALTER TABLE `historial_uso`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_carrete` (`carrete_id`),
  ADD KEY `idx_perfil` (`perfil_id`),
  ADD KEY `idx_fecha` (`fecha_hora`),
  ADD KEY `idx_uso_fecha_perfil` (`fecha_hora`,`perfil_id`);

--
-- Indices de la tabla `inventario_carretes`
--
ALTER TABLE `inventario_carretes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_perfil` (`perfil_id`),
  ADD KEY `idx_estado` (`estado`),
  ADD KEY `idx_carrete_perfil_estado` (`perfil_id`,`estado`);

--
-- Indices de la tabla `perfiles_filamento`
--
ALTER TABLE `perfiles_filamento`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_tipo` (`tipo`),
  ADD KEY `idx_marca` (`marca`);

--
-- Indices de la tabla `perfiles_proyecto`
--
ALTER TABLE `perfiles_proyecto`
  ADD PRIMARY KEY (`id`),
  ADD KEY `perfil_filamento_id` (`perfil_filamento_id`),
  ADD KEY `idx_nombre` (`nombre`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `configuracion`
--
ALTER TABLE `configuracion`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `calculos_cotizacion`
--
ALTER TABLE `calculos_cotizacion`
  ADD CONSTRAINT `calculos_cotizacion_ibfk_1` FOREIGN KEY (`cotizacion_id`) REFERENCES `cotizaciones` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `cotizaciones`
--
ALTER TABLE `cotizaciones`
  ADD CONSTRAINT `cotizaciones_ibfk_1` FOREIGN KEY (`perfil_filamento_id`) REFERENCES `perfiles_filamento` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `cotizaciones_ibfk_2` FOREIGN KEY (`carrete_id`) REFERENCES `inventario_carretes` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `historial_uso`
--
ALTER TABLE `historial_uso`
  ADD CONSTRAINT `historial_uso_ibfk_1` FOREIGN KEY (`carrete_id`) REFERENCES `inventario_carretes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `historial_uso_ibfk_2` FOREIGN KEY (`perfil_id`) REFERENCES `perfiles_filamento` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `inventario_carretes`
--
ALTER TABLE `inventario_carretes`
  ADD CONSTRAINT `inventario_carretes_ibfk_1` FOREIGN KEY (`perfil_id`) REFERENCES `perfiles_filamento` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `perfiles_proyecto`
--
ALTER TABLE `perfiles_proyecto`
  ADD CONSTRAINT `perfiles_proyecto_ibfk_1` FOREIGN KEY (`perfil_filamento_id`) REFERENCES `perfiles_filamento` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
