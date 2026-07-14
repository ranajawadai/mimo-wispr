@echo off
REM Mimo Wisper - double-click to open the dashboard (no need to touch .ps1 files).
REM Runs the PowerShell dashboard with an unrestricted execution policy.
setlocal
set "DIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%DIR%dashboard.ps1"
endlocal
