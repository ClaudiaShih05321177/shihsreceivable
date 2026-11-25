@echo off
REM AR-SYSTEM auto start: Docker Desktop -> database -> web (port 3001)
set APP_DIR=D:\SYS\AR-SYSTEM
set LOCAL_URL=http://192.168.0.2:54321
set LOCAL_KEY=sb_publishable_b9BmI0YGUIqtK4CFHs5raA_6TSQv8VT
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
taskkill /F /IM node.exe >nul 2>&1
start "AR-SYSTEM WEB" /min powershell -NoExit -Command "$env:SUPABASE_URL='%LOCAL_URL%'; $env:SUPABASE_PUBLISHABLE_KEY='%LOCAL_KEY%'; $env:VITE_SUPABASE_URL='%LOCAL_URL%'; $env:VITE_SUPABASE_PUBLISHABLE_KEY='%LOCAL_KEY%'; cd '%APP_DIR%'; npm run dev -- --port 3001 --host --strictPort"
echo Done. http://192.168.0.2:3001
timeout /t 10 >nul
