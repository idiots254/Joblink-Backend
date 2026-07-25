#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Joblink Debug APK Setup with Live Reload
.DESCRIPTION
    Automates the complete setup process for development with hot reload on Android
.PARAMETER LocalIP
    Specify a custom local IP address (auto-detected if not provided)
.PARAMETER SkipBuild
    Skip APK build if already built
.PARAMETER Debug
    Enable debug output with device logs
#>

param(
    [string]$LocalIP = $null,
    [switch]$SkipBuild = $false,
    [switch]$Debug = $false
)

$ErrorActionPreference = "Continue"
$ProjectRoot = $PSScriptRoot

function Write-Status {
    param([string]$Message, [string]$Type = "info")
    $colors = @{
        "info"    = "Cyan"
        "success" = "Green"
        "warning" = "Yellow"
        "error"   = "Red"
        "step"    = "Blue"
    }
    $prefix = @{
        "info"    = "ℹ️  "
        "success" = "✅ "
        "warning" = "⚠️  "
        "error"   = "❌ "
        "step"    = "👉 "
    }
    Write-Host "$($prefix[$Type])$Message" -ForegroundColor $colors[$Type]
}

function Get-LocalIP {
    try {
        $adapter = Get-NetRoute -DestinationPrefix 0.0.0.0/0 -ErrorAction Stop | 
                   Get-NetIPInterface -ErrorAction Stop | 
                   Where-Object { $_.ConnectionState -eq "Connected" } | 
                   Select-Object -First 1
        
        if ($adapter) {
            $ipInfo = Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction Stop | 
                      Select-Object -First 1
            return $ipInfo.IPAddress
        }
    } catch {
        Write-Status "Could not auto-detect IP: $_" "warning"
    }
    return $null
}

# Title
Write-Host "`n" + ("=" * 70) -ForegroundColor Cyan
Write-Host "  Joblink Debug APK Setup with Live Reload" -ForegroundColor Cyan
Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host ""

# Detect IP
if (-not $LocalIP) {
    Write-Status "Detecting local IP address..." "step"
    $LocalIP = Get-LocalIP
    if (-not $LocalIP) {
        $LocalIP = "192.168.100.5"
        Write-Status "Using fallback IP (may need adjustment): $LocalIP" "warning"
    } else {
        Write-Status "Detected local IP: $LocalIP" "success"
    }
} else {
    Write-Status "Using provided IP: $LocalIP" "info"
}

$DevPort = 8000
$DevURL = "http://$LocalIP`:$DevPort"

# Step 1: Validate environment
Write-Status "Validating environment..." "step"

try {
    $npmVersion = npm --version 2>&1
    Write-Status "NPM found: v$npmVersion" "success"
} catch {
    Write-Status "NPM not found. Please install Node.js" "error"
    exit 1
}

# Check Android SDK
if (-not $env:ANDROID_HOME) {
    $possiblePaths = @(
        "$env:LOCALAPPDATA\Android\sdk",
        "C:\Android\sdk",
        "$env:ProgramFiles\Android\sdk"
    )
    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            $env:ANDROID_HOME = $path
            Write-Status "Found Android SDK at: $path" "success"
            break
        }
    }
}

if (-not (Test-Path "$env:ANDROID_HOME\platform-tools\adb.exe")) {
    Write-Status "ADB not found. Please ensure Android SDK is installed" "error"
    exit 1
}

Write-Status "Android SDK found" "success"

# Check for running emulator
try {
    $adb = "$env:ANDROID_HOME\platform-tools\adb.exe"
    $devices = & $adb devices 2>&1
    if ($devices -match "emulator") {
        Write-Status "Android emulator is running" "success"
    } else {
        Write-Status "No emulator detected (will retry during install)" "warning"
    }
} catch {
    Write-Status "Could not check for emulator: $_" "warning"
}

# Step 2: Enable live reload config
Write-Status "Enabling live reload configuration..." "step"
Write-Status "Dev Server URL: $DevURL" "info"

node "$ProjectRoot\live-reload.js" dev $LocalIP
if ($LASTEXITCODE -ne 0) {
    Write-Status "Failed to configure live reload" "error"
    exit 1
}

# Step 3: Sync Capacitor
Write-Status "Syncing Capacitor to Android..." "step"
npx cap sync android
if ($LASTEXITCODE -ne 0) {
    Write-Status "Capacitor sync failed" "error"
    exit 1
}

# Step 4: Build APK
if (-not $SkipBuild) {
    Write-Status "Building debug APK..." "step"
    
    Push-Location "$ProjectRoot\android"
    .\gradlew.bat assembleDebug
    Pop-Location
    
    if ($LASTEXITCODE -ne 0) {
        Write-Status "APK build failed" "error"
        exit 1
    }
    
    if (-not (Test-Path "$ProjectRoot\android\app\build\outputs\apk\debug\app-debug.apk")) {
        Write-Status "APK not found after build" "error"
        exit 1
    }
    
    Write-Status "APK built successfully" "success"
} else {
    Write-Status "Skipping APK build" "info"
}

# Step 5: Install APK
Write-Status "Installing APK to device/emulator..." "step"
$adb = "$env:ANDROID_HOME\platform-tools\adb.exe"
& $adb install -r "$ProjectRoot\android\app\build\outputs\apk\debug\app-debug.apk"

if ($LASTEXITCODE -ne 0) {
    Write-Status "APK installation may have failed" "warning"
}

Write-Status "APK installed" "success"

# Step 6: Launch app
Write-Status "Launching Joblink app..." "step"
& $adb shell am start -n "com.joblink.app/.MainActivity"

if ($LASTEXITCODE -eq 0) {
    Write-Status "App launched" "success"
}

# Completion message
Write-Host ""
Write-Host ("=" * 70) -ForegroundColor Green
Write-Host "  ✅ Setup Complete!" -ForegroundColor Green
Write-Host ("=" * 70) -ForegroundColor Green
Write-Host ""

Write-Status "Dev Server URL: $DevURL" "info"
Write-Status "Next Steps:" "step"
Write-Host "  1. Start React dev server: npm start" -ForegroundColor White
Write-Host "  2. App should load in emulator (~10 seconds)" -ForegroundColor White
Write-Host "  3. Edit files in src/ and watch for hot reload" -ForegroundColor White
Write-Host ""

Write-Status "Troubleshooting:" "step"
Write-Host "  If app shows blank screen:" -ForegroundColor White
Write-Host "    • Check: adb logcat | Select-String 'ERROR'" -ForegroundColor Gray
Write-Host "    • Verify dev server running: curl http://localhost:$DevPort" -ForegroundColor Gray
Write-Host "    • Ping device: ping $LocalIP" -ForegroundColor Gray
Write-Host ""
Write-Host "  If network unreachable:" -ForegroundColor White
Write-Host "    • Check firewall: netstat -an | Select-String $DevPort" -ForegroundColor Gray
Write-Host "    • Correct IP: ipconfig" -ForegroundColor Gray
Write-Host "    • Rerun with custom IP: .\setup-live-reload.ps1 -LocalIP 192.168.1.X" -ForegroundColor Gray
Write-Host ""

if ($Debug) {
    Write-Status "Showing device logs..." "info"
    & "$adb" logcat -t 100 | Select-Object -Last 50
}

Write-Host ""
