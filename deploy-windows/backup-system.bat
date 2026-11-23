@echo off
REM AR-SYSTEM one-click database backup (keeps last 30 days)
set BACKUP_DIR=D:\AR-BACKUPS
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

for /f "usebackq delims=" %%t in (`powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmm"`) do set TS=%%t
set FILE=ar_backup_%TS%.backup

set DB=
for /f "usebackq delims=" %%c in (`docker ps --filter "name=supabase_db" --format "{{.Names}}"`) do set DB=%%c
if "%DB%"=="" (
  echo [ERROR] Database container not running. Start Docker Desktop / start-system.bat first.
  echo %date% %time% FAILED: database not running>> "%BACKUP_DIR%\backup-log.txt"
  timeout /t 15 >nul
  exit /b 1
)

echo Backing up database from %DB% ...
docker exec %DB% pg_dump -U postgres -d postgres -Fc -f /tmp/%FILE%
if errorlevel 1 goto fail
docker cp %DB%:/tmp/%FILE% "%BACKUP_DIR%\%FILE%"
if errorlevel 1 goto fail
docker exec %DB% rm -f /tmp/%FILE%

forfiles /p "%BACKUP_DIR%" /m ar_backup_*.backup /d -30 /c "cmd /c del @path" >nul 2>&1

echo %date% %time% OK: %FILE%>> "%BACKUP_DIR%\backup-log.txt"
echo Done: %BACKUP_DIR%\%FILE%
timeout /t 10 >nul
exit /b 0

:fail
echo %date% %time% FAILED: %FILE%>> "%BACKUP_DIR%\backup-log.txt"
echo [ERROR] Backup failed.
timeout /t 15 >nul
exit /b 1
