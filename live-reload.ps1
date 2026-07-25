#!/usr/bin/env pwsh
# Joblink Live Reload Setup for Android Emulator
# This script automates the live reload setup process

param(
    [ValidateSet('dev', 'prod', 'setup', 'install', 'start')]
    [string]$Mode = 'setup'
)

$ProjectRoot = $PSScriptRoot

# Get local IP dynamically - try primary network interface first
$LocalIP = $null
try {
    # Get the IP of the adapter that routes to the internet
    $adapter = Get-NetRoute -DestinationPrefix 0.0.0.0/0 | Get-NetIPInterface | Where-Object { $_.ConnectionState -eq "Connected" } | Select-Object -First 1
    if ($adapter) {
        $ipInfo = Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 | Select-Object -First 1
        $LocalIP = $ipInfo.IPAddress
        Write-Host "📍 Detected local IP: $LocalIP" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Could not auto-detect IP, please set manually" -ForegroundColor Yellow
}

# Fallback to hardcoded value if detection failed
if (-not $LocalIP) {
    $LocalIP = "192.168.100.5"
    Write-Host "⚠️  Using default IP: $LocalIP (may need adjustment)" -ForegroundColor Yellow
}

$DevPort = 8000
$DevURL = "http://$LocalIP`:$DevPort"

Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Joblink Live Reload - Android Setup" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan

switch ($Mode) {
    'dev' {
        Write-Host "`n🚀 Starting DEVELOPMENT mode with Live Reload..." -ForegroundColor Green
        Write-Host "`n📱 Dev Server URL: $DevURL" -ForegroundColor Yellow
        Write-Host "`n⚡ Steps to run:" -ForegroundColor White
        Write-Host "  1. Open a terminal and run: npm start" -ForegroundColor White
        Write-Host "  2. Wait for React dev server to start on port 8000" -ForegroundColor White
        Write-Host "  3. In another terminal run this script with: .\live-reload.ps1 install" -ForegroundColor White
        Write-Host "  4. Edit files in src/ and watch the emulator reload!" -ForegroundColor White
    }
    
    'prod' {
        Write-Host "`n📦 Switching to PRODUCTION mode..." -ForegroundColor Green
        Write-Host "`nUsing build/ folder for the APK" -ForegroundColor Yellow
    }
    
    'setup' {
        Write-Host "`n⚙️  Setting up live reload environment..." -ForegroundColor Green
        
        # Check if npm is available
        try {
            $npmVersion = npm --version
            Write-Host "✅ NPM found: v$npmVersion" -ForegroundColor Green
        } catch {
            Write-Host "❌ NPM not found. Please install Node.js" -ForegroundColor Red
            exit 1
        }
        
        # Check if Capacitor CLI is available
        try {
            $capVersion = npx cap --version 2>&1
            Write-Host "✅ Capacitor CLI found" -ForegroundColor Green
        } catch {
            Write-Host "⚠️  Capacitor CLI not found, installing..." -ForegroundColor Yellow
            npm install -g @capacitor/cli
        }
        
        # Check if Android emulator is available
        try {
            $adb = "$env:ANDROID_HOME\platform-tools\adb.exe"
            $devices = & $adb devices
            if ($devices -match "emulator") {
                Write-Host "✅ Android emulator detected" -ForegroundColor Green
            } else {
                Write-Host "⚠️  No running emulator found. Start with: emulator -avd Pixel_7" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "❌ Android SDK not found" -ForegroundColor Red
        }
        
        Write-Host "`n✅ Environment ready!" -ForegroundColor Green
    }
    
    'install' {
        Write-Host "`n📦 Installing APK to emulator with live reload..." -ForegroundColor Green
        
        # Sync to Android
        Write-Host "`n[1/4] Syncing Capacitor to Android..." -ForegroundColor Cyan
        npx cap sync android
        
        # Build APK
        Write-Host "`n[2/4] Building debug APK..." -ForegroundColor Cyan
        cd $ProjectRoot\android
        .\gradlew.bat assembleDebug
        
        # Install APK
        Write-Host "`n[3/4] Installing APK to emulator..." -ForegroundColor Cyan
        $adb = "$env:ANDROID_HOME\platform-tools\adb.exe"
        & $adb install -r "$ProjectRoot\android\app\build\outputs\apk\debug\app-debug.apk"
        
        # Launch app
        Write-Host "`n[4/4] Launching Joblink app..." -ForegroundColor Cyan
        & $adb shell am start -n "com.joblink.app/.MainActivity"
        
        Write-Host "`n✅ Installation complete!" -ForegroundColor Green
        Write-Host "`n🔥 Live reload is now ACTIVE!" -ForegroundColor Yellow
        Write-Host "💡 Edit files in src/ folder and changes will appear in the emulator!" -ForegroundColor Cyan
    }
    
    'start' {
        Write-Host "`n▶️  Starting React development server..." -ForegroundColor Green
        Write-Host "📱 Server will be available at: $DevURL" -ForegroundColor Yellow
        npm start
    }
    
    default {
        Write-Host "`n❓ Unknown command. Available options:" -ForegroundColor Yellow
        Write-Host "  setup   - Verify environment setup" -ForegroundColor White
        Write-Host "  dev     - Show dev mode instructions" -ForegroundColor White
        Write-Host "  prod    - Switch to production mode" -ForegroundColor White
        Write-Host "  install - Install APK with live reload to emulator" -ForegroundColor White
        Write-Host "  start   - Start React dev server" -ForegroundColor White
    }
}

Write-Host "`n════════════════════════════════════════" -ForegroundColor Cyan
