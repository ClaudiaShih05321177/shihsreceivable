@echo off
REM Put a shortcut of start-system.bat in the Windows Startup folder
set SRC=%~dp0start-system.bat
set LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\AR-SYSTEM.lnk
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%LNK%');$s.TargetPath='%SRC%';$s.WorkingDirectory='%~dp0';$s.WindowStyle=7;$s.Save()"
echo Auto start installed: %LNK%
pause
