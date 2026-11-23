@echo off
REM AR-SYSTEM auto start: Docker Desktop -> database -> web (port 3001)
set APP_DIR=D:\SYS\AR-SYSTEM
cd /d %APP_DIR%

echo [1/3] Starting Docker Desktop...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"

:waitdocker
docker info >nul 2>&1
if errorlevel 1 (
  echo   waiting for Docker engine...
  timeout /t 5 /nobreak >nul
  goto waitdocker
)

echo [2/3] Starting database...
call npx supabase start

echo [3/3] Starting web system on port 3001...
start "AR-SYSTEM WEB" /min cmd /k "cd /d %APP_DIR% && npm run dev -- --port 3001 --host"
echo Done. http://192.168.0.2:3001
timeout /t 10 >nul
