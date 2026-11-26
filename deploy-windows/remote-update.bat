@echo off
setlocal
REM Run this on your own computer to update the company host at 192.168.0.2.
set HOST=192.168.0.2
set HOST_USER=
set LNK=%USERPROFILE%\Desktop\遠端更新公司 AR 主機.lnk

where ssh >nul 2>&1
if errorlevel 1 (
  echo Windows remote connection is not available on this computer.
  echo Please install Windows OpenSSH Client, then run this button again.
  pause
  exit /b 1
)

if not exist "%LNK%" (
  powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%LNK%');$s.TargetPath='%~f0';$s.WorkingDirectory='%~dp0';$s.WindowStyle=1;$s.Save()"
)

if "%HOST_USER%"=="" set /p HOST_USER=Company host Windows account: 

echo.
echo Connecting to the company host. Enter its Windows password when asked.
echo The password is not saved by this program.
echo.
ssh -o ConnectTimeout=10 -o ServerAliveInterval=15 "%HOST_USER%@%HOST%" "powershell -NoProfile -ExecutionPolicy Bypass -File D:\SYS\AR-SYSTEM\deploy-windows\remote-update-host.ps1"
if errorlevel 1 (
  echo.
  echo Remote update did not complete. Please send this screen for troubleshooting.
  pause
  exit /b 1
)

echo.
echo Success. Your computer updated the company host.
echo Open http://192.168.0.2:3001 and press Ctrl+F5.
pause
