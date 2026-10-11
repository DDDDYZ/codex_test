@echo off
setlocal
cd /d "%~dp0"
echo Flight Dynamics Lab - Windows setup
where node >nul 2>nul
if errorlevel 1 goto install_node
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=12)?0:1)"
if not errorlevel 1 goto dependencies
:install_node
where winget >nul 2>nul
if errorlevel 1 goto manual_node
echo Installing Node.js LTS with Windows Package Manager...
winget install --id OpenJS.NodeJS.LTS --exact --source winget --accept-source-agreements --accept-package-agreements --silent
if errorlevel 1 goto manual_node
set "PATH=%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs;%LOCALAPPDATA%\Programs\nodejs;%PATH%"
where node >nul 2>nul
if errorlevel 1 goto reopen
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=12)?0:1)"
if errorlevel 1 goto reopen
:dependencies
echo Installing locked dependencies...
call npm ci --no-audit --no-fund
if errorlevel 1 goto failed
echo Checking TypeScript...
call npm run typecheck
if errorlevel 1 goto failed
echo Running model verification tests...
call npm test
if errorlevel 1 goto failed
echo Starting website. Keep this window open. Press Ctrl+C to stop.
call npm run dev -- --host 127.0.0.1 --port 5173 --strictPort --open
if errorlevel 1 goto failed
exit /b 0
:manual_node
echo Install Node.js LTS from https://nodejs.org/ then run this file again.
echo Required version: Node.js 22.12 or newer.
start "" "https://nodejs.org/en/download"
pause
exit /b 1
:reopen
echo Close this window and run this file again to refresh Node.js PATH.
echo If the old Node.js is still selected, update or remove the old installation.
pause
exit /b 1
:failed
echo Setup failed. Copy the error above and send it for troubleshooting.
echo If port 5173 is in use, close the previous server window first.
pause
exit /b 1
