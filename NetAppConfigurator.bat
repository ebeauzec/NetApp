@echo off
title NetApp Solutions Architect Configurator
cd /d "%~dp0"

echo Launching NetApp Solutions Architect Configurator...

rem Best-effort: start the local "Check for Updates" helper in the background
rem so the button works immediately. If Python isn't installed, this is
rem silently skipped -- the app still opens and works fully offline, the
rem Check for Updates button just shows instructions instead of results.
where python >nul 2>nul
if %errorlevel%==0 (
  curl -s -m 1 http://127.0.0.1:8766/health >nul 2>nul
  if errorlevel 1 (
    start "NetApp Configurator Update Helper" /min python "%~dp0tools\update_server.py"
  )
)

start msedge "%~dp0NetAppConfigurator_Offline.html"
