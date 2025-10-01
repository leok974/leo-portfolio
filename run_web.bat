@echo off
setlocal

if not defined WEB_PORT set WEB_PORT=5530

echo [web] Serving static site on http://127.0.0.1:%WEB_PORT%
where npx >nul 2>&1
if errorlevel 1 (
  echo [web] ERROR: npx not found. Install Node.js first: https://nodejs.org/
  pause
  exit /b 1
)

npx browser-sync start --server --no-ui --no-notify --host 127.0.0.1 --port %WEB_PORT% --files "index.html,*.css,main.js,js/**/*.js,projects/**/*.html,assets/**/*,manifest.webmanifest,sw.js,projects.json"
set EXITCODE=%ERRORLEVEL%

echo.
echo [web] Server exited (code %EXITCODE%). Press any key to close...
pause >nul
exit /b %EXITCODE%
