# ADHD Tools - Windows One-Click Installer
$ErrorActionPreference = 'Stop'
Write-Host "=== Installing ADHD Tools for Windows ===" -ForegroundColor Cyan

$appDir = "$env:LOCALAPPDATA\Programs\ADHD Tools"
New-Item -ItemType Directory -Force -Path $appDir | Out-Null

$targetExe = "$appDir\ADHD Tools.exe"

# 1. Try to download pre-built release from GitHub if available
$releaseUrl = "https://github.com/jobellet/ADHDtools/releases/latest/download/ADHD-Tools-Setup.exe"
$installerTemp = "$env:TEMP\ADHD-Tools-Setup.exe"

$downloadSucceeded = $false
try {
    Write-Host "Checking for latest release online..." -ForegroundColor Gray
    Invoke-WebRequest -Uri $releaseUrl -OutFile $installerTemp -UseBasicParsing -TimeoutSec 15
    if ((Get-Item $installerTemp).Length -gt 1000000) {
        Write-Host "Downloaded latest installer. Running setup..." -ForegroundColor Green
        Start-Process -FilePath $installerTemp -ArgumentList "/S" -Wait
        $downloadSucceeded = $true
    }
} catch {
    $downloadSucceeded = $false
}

# 2. If no prebuilt binary was downloaded, build locally
if (-not $downloadSucceeded) {
    Write-Host "Building desktop app locally via npm..." -ForegroundColor Yellow
    npm run desktop:build
    $localExe = Join-Path $PSScriptRoot "..\src-tauri\target\release\adhdtools.exe"
    if (-not (Test-Path $localExe)) {
        throw "Build output not found at $localExe"
    }
    Stop-Process -Name "adhdtools" -Force -ErrorAction SilentlyContinue
    Stop-Process -Name "ADHD Tools" -Force -ErrorAction SilentlyContinue
    Copy-Item -Path $localExe -Destination $targetExe -Force
}

# 3. Create Start Menu Shortcut
$shortcutPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\ADHD Tools.lnk"
$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($shortcutPath)
$sc.TargetPath = $targetExe
$sc.Description = "ADHD Tools Hub"
$sc.Save()

Write-Host "`n✓ ADHD Tools installed successfully into Start Menu!" -ForegroundColor Green
Write-Host "Starting app..." -ForegroundColor Cyan
Start-Process $targetExe
