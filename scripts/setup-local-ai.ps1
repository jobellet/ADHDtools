# scripts/setup-local-ai.ps1
# Automated installer for Local AI (LFM3-1.7B + llama.cpp) for ADHDtools on Windows.
# Run from PowerShell:
#   powershell -ExecutionPolicy Bypass -File scripts/setup-local-ai.ps1
# Or as a one-liner:
#   irm https://raw.githubusercontent.com/jobellet/ADHDtools/main/scripts/setup-local-ai.ps1 | iex

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   ADHDtools - Local AI Setup (LFM3 1.7B + llama.cpp)     " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$installDir = "$env:LOCALAPPDATA\llama-cpp"
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}

$llamaZipUrl = "https://github.com/ggerganov/llama.cpp/releases/download/b12019/llama-b12019-bin-win-cpu-x64.zip"
$modelGgufUrl = "https://huggingface.co/LiquidAI/LFM3-1.7B-GGUF/resolve/main/LFM3-1.7B-QAD-Q4_0.gguf"
$serverExe = "$installDir\llama-server.exe"
$modelFile = "$installDir\LFM3-1.7B-QAD-Q4_0.gguf"

# 1. Download llama.cpp binaries if not present
if (-not (Test-Path $serverExe)) {
    Write-Host "[1/2] Downloading llama.cpp binaries (~23 MB)..." -ForegroundColor Yellow
    $zipPath = "$env:TEMP\llama-cpp-win.zip"
    curl.exe -L -o $zipPath $llamaZipUrl
    Expand-Archive -Path $zipPath -DestinationPath $installDir -Force
    Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
    Write-Host "  -> llama.cpp extracted to $installDir" -ForegroundColor Green
} else {
    Write-Host "[1/2] llama.cpp is already installed in $installDir" -ForegroundColor Green
}

# 2. Download LFM3-1.7B GGUF model if not present
if (-not (Test-Path $modelFile)) {
    Write-Host "[2/2] Downloading Liquid AI LFM3-1.7B model (~1.05 GB)..." -ForegroundColor Yellow
    Write-Host "      (This may take 1-3 minutes depending on your internet connection)" -ForegroundColor Gray
    curl.exe -L -o $modelFile $modelGgufUrl
    Write-Host "  -> Model saved to $modelFile" -ForegroundColor Green
} else {
    Write-Host "[2/2] LFM3 model is already downloaded in $installDir" -ForegroundColor Green
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "   Installation complete!                                " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "How to use with ADHDtools:" -ForegroundColor White
Write-Host "1. Open the ADHDtools Desktop application." -ForegroundColor Gray
Write-Host "2. A button 'Local AI' / 'IA locale' will now appear in your header." -ForegroundColor Gray
Write-Host "3. Click it to start or stop the local server anytime." -ForegroundColor Gray
Write-Host "4. In ADHDtools Settings > AI Assistant, configure:" -ForegroundColor Gray
Write-Host "   - Provider: Custom / Local" -ForegroundColor Gray
Write-Host "   - Base URL: http://localhost:11434/v1" -ForegroundColor Gray
Write-Host "   - Model: lfm3" -ForegroundColor Gray
Write-Host ""
