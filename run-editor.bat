@echo off
setlocal
cd /d "%~dp0"

python --version >nul 2>&1
if not errorlevel 1 (
    set "EDITOR_PYTHON=python"
    goto start_editor
)
py -3 --version >nul 2>&1
if not errorlevel 1 (
    set "EDITOR_PYTHON=py -3"
    goto start_editor
)
echo Python 3 is required. Install Python and enable its PATH option.
pause
exit /b 1

:start_editor
echo Starting this game's level editor.
echo Open the URL printed below. Press Ctrl+C to stop the server.
%EDITOR_PYTHON% "editor\2D\server.py" %*
set "EDITOR_EXIT=%ERRORLEVEL%"
if not "%EDITOR_EXIT%"=="0" pause
exit /b %EDITOR_EXIT%
