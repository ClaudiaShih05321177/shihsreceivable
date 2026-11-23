@echo off
setlocal EnableDelayedExpansion
REM AR-SYSTEM one-click database restore
set BACKUP_DIR=D:\AR-BACKUPS

set DB=
for /f "usebackq delims=" %%c in (`docker ps --filter "name=supabase_db" --format "{{.Names}}"`) do set DB=%%c
if "%DB%"=="" (
  echo [ERROR] Database container not running. Start Docker Desktop / start-system.bat first.
  pause
  exit /b 1
)

echo Backups in %BACKUP_DIR% (newest first):
set N=0
for /f "usebackq delims=" %%f in (`dir /b /o-d "%BACKUP_DIR%\*.backup" 2^>nul`) do (
  set /a N+=1
  set "F!N!=%%f"
  if !N! LEQ 20 echo   !N!. %%f
)
if %N%==0 (
  echo [ERROR] No .backup files found in %BACKUP_DIR%.
  pause
  exit /b 1
)

echo.
set /p CHOICE=Enter number to restore (blank = cancel): 
if "%CHOICE%"=="" exit /b 0
set "FILE=!F%CHOICE%!"
if "%FILE%"=="" (
  echo [ERROR] Invalid number.
  pause
  exit /b 1
)

echo.
echo WARNING: Current data will be REPLACED by %FILE%
set /p OK=Type YES to continue: 
if /i not "%OK%"=="YES" (
  echo Cancelled.
  pause
  exit /b 0
)

echo Restoring %FILE% ...
docker cp "%BACKUP_DIR%\%FILE%" %DB%:/tmp/restore.backup
if errorlevel 1 goto fail
docker exec %DB% pg_restore -U postgres -d postgres --clean --if-exists --no-owner /tmp/restore.backup
docker exec %DB% rm -f /tmp/restore.backup

echo %date% %time% RESTORED: %FILE%>> "%BACKUP_DIR%\backup-log.txt"
echo.
echo Done. Some WARNING lines above are normal. Refresh the browser.
pause
exit /b 0

:fail
echo [ERROR] Restore failed.
pause
exit /b 1
