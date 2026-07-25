@echo off
REM Joblink Debug APK Setup with Live Reload
REM This script automates the complete setup process

setlocal enabledelayedexpansion

color 0A
echo.
echo ════════════════════════════════════════════════════════
echo   Joblink Debug APK with Live Reload Setup
echo ════════════════════════════════════════════════════════
echo.

REM Get local IP address using PowerShell
for /f "tokens=*" %%A in ('powershell -Command "Get-NetRoute -DestinationPrefix 0.0.0.0/0 | Get-NetIPInterface | Where-Object {$_.ConnectionState -eq 'Connected'} | Select-Object -First 1 -ExpandProperty ifIndex | ForEach-Object {Get-NetIPAddress -InterfaceIndex $_ -AddressFamily IPv4 | Select-Object -First 1 -ExpandProperty IPAddress}"') do set "LocalIP=%%A"

if not defined LocalIP (
    set "LocalIP=192.168.100.5"
    echo [WARNING] Could not detect IP, using fallback: %LocalIP%
) else (
    echo [OK] Detected local IP: %LocalIP%
)

echo.
echo Step 1: Enabling live reload configuration...
call npm run android:dev

echo.
echo Step 2: Syncing Capacitor to Android...
call npx cap sync android

echo.
echo Step 3: Building debug APK...
cd android
call gradlew.bat assembleDebug
cd ..

if not exist "android\app\build\outputs\apk\debug\app-debug.apk" (
    echo [ERROR] APK build failed!
    pause
    exit /b 1
)

echo [OK] APK built successfully

echo.
echo Step 4: Installing APK to device/emulator...
for /f "tokens=*" %%A in ('where adb') do set "ADB=%%A"
if not defined ADB (
    echo [ERROR] ADB not found in PATH. Please ensure Android SDK is installed.
    pause
    exit /b 1
)

"%ADB%" install -r "android\app\build\outputs\apk\debug\app-debug.apk"

echo.
echo Step 5: Launching app...
"%ADB%" shell am start -n "com.joblink.app/.MainActivity"

echo.
echo ════════════════════════════════════════════════════════
echo   ✅ Setup Complete!
echo ════════════════════════════════════════════════════════
echo.
echo Dev Server will be accessible at: http://%LocalIP%:8000
echo.
echo NEXT STEPS:
echo   1. Make sure React dev server is running (npm start in another terminal)
echo   2. Check that the app loads in the emulator
echo   3. Edit files in src/ folder
echo   4. Watch for hot reload changes in the emulator
echo.
echo TROUBLESHOOTING:
echo   - If app shows blank screen, check console: adb logcat
echo   - If can't connect to dev server, verify:
echo     • Dev server running on port 8000
echo     • Firewall allows port 8000
echo     • IP address is correct (check: ipconfig)
echo.
pause
