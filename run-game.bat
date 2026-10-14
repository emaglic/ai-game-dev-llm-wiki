@echo off
setlocal
cd /d "%~dp0"

python --version >nul 2>&1
if not errorlevel 1 (
    set "GAME_PYTHON=python"
    goto start_game
)
py -3 --version >nul 2>&1
if not errorlevel 1 (
    set "GAME_PYTHON=py -3"
    goto start_game
)
echo Python 3 is required. Install Python and enable its PATH option.
pause
exit /b 1

:start_game
set "GAME_PORT=8000"
if not "%~1"=="" set "GAME_PORT=%~1"
echo Starting the game server at http://127.0.0.1:%GAME_PORT%/
echo Press Ctrl+C to stop the server.
%GAME_PYTHON% -m http.server "%GAME_PORT%" --bind 127.0.0.1 --directory "game"
set "GAME_EXIT=%ERRORLEVEL%"
if not "%GAME_EXIT%"=="0" pause
exit /b %GAME_EXIT%
