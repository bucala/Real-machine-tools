@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" py -3 -m venv .venv
if errorlevel 1 goto fail
.venv\Scripts\python.exe -m pip install -r requirements-windows.txt
if errorlevel 1 goto fail
if "%~1"=="" (
  .venv\Scripts\python.exe bridge.py
) else (
  .venv\Scripts\python.exe bridge.py --nc-root "%~1"
)
pause
exit /b
:fail
echo Install Python 3.11 or later for Windows, with the Python launcher enabled.
pause
exit /b 1
