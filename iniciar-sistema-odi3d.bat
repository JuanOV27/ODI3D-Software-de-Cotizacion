@echo off
title Sistema ODI3D — Iniciando...
color 0A

echo.
echo  =====================================================
echo   SISTEMA ODI3D — LANZADOR COMPLETO
echo  =====================================================
echo.

:: ── 1. INICIAR APACHE (XAMPP) ──────────────────────────
echo  [1/3] Iniciando Apache (XAMPP)...
sc query Apache2.4 >nul 2>&1
if %errorlevel% equ 0 (
    net start Apache2.4 >nul 2>&1
    if %errorlevel% equ 0 (
        echo       Apache iniciado correctamente.
    ) else (
        echo       Apache ya estaba corriendo.
    )
) else (
    :: Intentar con el ejecutable de XAMPP directamente
    if exist "C:\xampp\apache\bin\httpd.exe" (
        start "" /B "C:\xampp\xampp-control.exe"
        echo       Iniciando XAMPP Control Panel...
    ) else (
        echo       [AVISO] No se pudo iniciar Apache automaticamente.
        echo       Inicia XAMPP manualmente si es necesario.
    )
)

echo.

:: ── 2. INICIAR MYSQL (XAMPP) ───────────────────────────
echo  [2/3] Iniciando MySQL (XAMPP)...
sc query mysql >nul 2>&1
if %errorlevel% equ 0 (
    net start mysql >nul 2>&1
    if %errorlevel% equ 0 (
        echo       MySQL iniciado correctamente.
    ) else (
        echo       MySQL ya estaba corriendo.
    )
) else (
    echo       [AVISO] MySQL como servicio no encontrado (puede que XAMPP lo maneje directamente).
)

echo.

:: ── 3. INICIAR KIRI:MOTO ───────────────────────────────
echo  [3/3] Iniciando Kiri:Moto (puerto 8080)...

:: Verificar si ya esta corriendo
powershell -Command "try { (New-Object System.Net.Sockets.TcpClient('127.0.0.1', 8080)).Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 (
    echo       Kiri:Moto ya esta corriendo en puerto 8080.
) else (
    if exist "%~dp0grid-apps\node_modules" (
        start "Kiri:Moto ODI3D" /MIN "%~dp0start-kirimoto.bat"
        echo       Kiri:Moto iniciando en segundo plano...
        echo       (ventana minimizada en barra de tareas)
    ) else (
        echo       [AVISO] node_modules no encontrado.
        echo       Ejecuta start-kirimoto.bat una primera vez para instalar dependencias.
    )
)

echo.

:: ── RESULTADO ──────────────────────────────────────────
echo  =====================================================
echo   Sistema listo (espera ~15 segundos a Kiri:Moto)
echo  =====================================================
echo.
echo   Software ODI3D:  http://localhost/gestion3d/
echo   Kiri:Moto:       http://localhost:8080/kiri/
echo.

:: Abrir el navegador con el software
timeout /t 3 /nobreak >nul
start "" "http://localhost/gestion3d/"

exit /b 0
