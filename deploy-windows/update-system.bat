@echo off
REM AR-SYSTEM one-click update: pull latest code, keep local settings, restart web on port 3001
set APP_DIR=D:\SYS\AR-SYSTEM
set LOCAL_URL=http://192.168.0.2:54321
set LOCAL_KEY=sb_publishable_b9BmI0YGUIqtK4CFHs5raA_6TSQv8VT
cd /d %APP_DIR%

echo [1/5] Stopping old web service...
docker rm -f ar-web >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1

echo [2/5] Pulling latest code...
git checkout -- .env deploy-windows >nul 2>&1
git pull
if errorlevel 1 (
  echo.
  echo *** git pull failed. Please send this screen for troubleshooting. ***
  if "%~1"=="--remote" exit /b 1
  pause
  exit /b 1
)

echo [3/5] Restoring local database settings...
> .env echo VITE_SUPABASE_URL=%LOCAL_URL%
>> .env echo VITE_SUPABASE_PUBLISHABLE_KEY=%LOCAL_KEY%
>> .env echo VITE_SUPABASE_PROJECT_ID=vqxjljihotvlvglbqvgp
>> .env echo SUPABASE_URL=%LOCAL_URL%
>> .env echo SUPABASE_PUBLISHABLE_KEY=%LOCAL_KEY%

echo [4/5] Installing packages...
call npm install
if errorlevel 1 (
  echo.
  echo *** npm install failed. Please send this screen for troubleshooting. ***
  if "%~1"=="--remote" exit /b 1
  pause
  exit /b 1
)
if exist node_modules\.vite rmdir /s /q node_modules\.vite

echo [4b] Updating local database columns...
set DB=
for /f "usebackq delims=" %%c in (`docker ps --filter "name=supabase_db" --format "{{.Names}}"`) do set DB=%%c
if not "%DB%"=="" (
  docker exec -i %DB% psql -U postgres -d postgres < drizzle\migrations\0064_payment_check_details.sql
  docker exec %DB% psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';"
)

echo [5/5] Starting web on port 3001...
start "AR-SYSTEM WEB" /min powershell -NoExit -Command "$env:SUPABASE_URL='%LOCAL_URL%'; $env:SUPABASE_PUBLISHABLE_KEY='%LOCAL_KEY%'; $env:VITE_SUPABASE_URL='%LOCAL_URL%'; $env:VITE_SUPABASE_PUBLISHABLE_KEY='%LOCAL_KEY%'; cd '%APP_DIR%'; npm run dev -- --port 3001 --host --strictPort"

echo.
echo Done. Open http://192.168.0.2:3001 and press Ctrl+F5
if "%~1"=="--remote" exit /b 0
pause
