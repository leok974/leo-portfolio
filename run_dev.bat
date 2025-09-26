@echo off
setlocal

REM --- Config ---
if not defined PORT set PORT=8010
if not defined HOST set HOST=127.0.0.1
if not defined APP set APP=assistant_api.main:app

REM --- Venv detection (adjust if your venv path differs) ---
set VENV_DIR=.venv\Scripts
if not exist "%VENV_DIR%\python.exe" (
  echo [run_dev] ERROR: .venv not found at %VENV_DIR%
  echo Create it with: python -m venv .venv && .venv\Scripts\activate && pip install -r assistant_api\requirements.txt
  pause
  exit /b 1
)

REM --- Launch via Windows-friendly runner (forces selector loop) ---
"%VENV_DIR%\python.exe" assistant_api\run_cmddev.py
set EXITCODE=%ERRORLEVEL%

echo.
echo [run_dev] Server exited (code %EXITCODE%). Press any key to close...
pause >nul
exit /b %EXITCODE%
