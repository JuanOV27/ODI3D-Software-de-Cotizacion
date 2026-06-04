@echo off
title Kiri:Moto — ODI3D (puerto 8080)
color 0A

echo.
echo  ============================================
echo   Kiri:Moto ^| Laminador Local ^| ODI3D
echo  ============================================
echo   URL: http://localhost:8080/kiri/
echo  ============================================
echo.

:: Verificar que node este instalado
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js no encontrado en PATH.
    echo  Descarga Node.js desde https://nodejs.org/ e instala la version 22+
    pause
    exit /b 1
)

:: Navegar al directorio grid-apps (relativo a este .bat)
cd /d "%~dp0grid-apps"

if not exist "node_modules" (
    echo  [ADVERTENCIA] node_modules no encontrado.
    echo  Instalando dependencias (puede tardar varios minutos)...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo  [ERROR] Fallo npm install
        pause
        exit /b 1
    )
)

echo  Iniciando servidor...
echo  Presiona Ctrl+C para detener.
echo.

npm run dev
pause
