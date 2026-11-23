@echo off
REM Register daily automatic backup at 18:30 (run as Administrator)
set SRC=%~dp0backup-system.bat
schtasks /Create /TN "AR-SYSTEM Daily Backup" /TR "\"%SRC%\"" /SC DAILY /ST 18:30 /RL HIGHEST /F
echo Daily backup scheduled at 18:30. Files go to D:\AR-BACKUPS
pause
