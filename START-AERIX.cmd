@echo off
cd /d "%~dp0"
echo Starting AERIX. Open http://localhost:4000 in your browser.
echo Keep this window open. Press Ctrl+C to stop.
call npm.cmd start
pause
