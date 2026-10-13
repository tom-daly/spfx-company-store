@echo off
rem Build, test and package the Company Store web part.
rem The package lands in sharepoint\solution\react-company-store.sppkg, ready for the app catalog.
rem Stop "npm start" first: this build clears the folders it serves from.

setlocal
cd /d "%~dp0"

if not exist node_modules (
  echo Installing packages...
  call npm install || goto :failed
)

if exist sharepoint\solution rmdir /s /q sharepoint\solution
call npm run build || goto :failed

echo.
echo Package ready: %~dp0sharepoint\solution\react-company-store.sppkg
exit /b 0

:failed
echo.
echo Build failed - see the messages above.
exit /b 1
