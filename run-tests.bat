@echo off
echo Starting Larkova Art website tests...

REM Start the HTTP server in background
start /B python -m http.server 8000

REM Wait for server to start
timeout /t 2 /nobreak > nul

REM Run Playwright tests
cd test
npx playwright test

REM Cleanup - stop server (this is tricky in batch, user will need to manually stop)
echo Tests completed. Please manually stop the HTTP server.