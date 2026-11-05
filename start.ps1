# ============================================================
#  SADEWA — Start All Services
#  Jalankan: .\start.ps1  (dari folder SADEWA/)
# ============================================================

$ROOT   = Split-Path -Parent $MyInvocation.MyCommand.Path
$VENV   = "$ROOT\..\venv\Scripts"
$AI_DIR = "$ROOT\ai"
$BE_DIR = "$ROOT\backend"
$FE_DIR = "$ROOT\frontend"

function Info($msg)    { Write-Host $msg -ForegroundColor Cyan }
function Success($msg) { Write-Host $msg -ForegroundColor Green }
function Warn($msg)    { Write-Host $msg -ForegroundColor Yellow }

Clear-Host
Write-Host "======================================" -ForegroundColor Magenta
Write-Host "   SADEWA -- Starting All Services    " -ForegroundColor Magenta
Write-Host "======================================" -ForegroundColor Magenta
Write-Host ""

# --- Cek venv -------------------------------------------------------
if (-not (Test-Path "$VENV\uvicorn.exe")) {
    Write-Host "[ERROR] venv tidak ditemukan." -ForegroundColor Red
    Write-Host "Jalankan dulu:"
    Write-Host "  python -m venv venv"
    Write-Host "  venv\Scripts\pip install -e SADEWA/ai[api]"
    Write-Host "  venv\Scripts\pip install -r SADEWA\backend\requirements.txt"
    exit 1
}

# --- Cek node_modules -----------------------------------------------
if (-not (Test-Path "$FE_DIR\node_modules")) {
    Warn "[!] node_modules belum ada. Menjalankan npm install..."
    Push-Location $FE_DIR
    npm install --silent
    Pop-Location
}

# --- Jalankan AI Service (port 8001) --------------------------------
Info "[1/3] Memulai AI Service   -> http://localhost:8001"
$aiCmd = "Set-Location '$AI_DIR'; & '$VENV\uvicorn.exe' sadewa_ai.api:app --host 0.0.0.0 --port 8001 --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $aiCmd

Start-Sleep -Seconds 2

# --- Jalankan Backend (port 8000) -----------------------------------
Info "[2/3] Memulai Backend      -> http://localhost:8000"
$beCmd = "Set-Location '$BE_DIR'; & '$VENV\uvicorn.exe' app.main:app --host 0.0.0.0 --port 8000 --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $beCmd

Start-Sleep -Seconds 2

# --- Jalankan Frontend (port 5173) ----------------------------------
Info "[3/3] Memulai Frontend     -> http://localhost:5173"
$feCmd = "Set-Location '$FE_DIR'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $feCmd

# --- Ringkasan -------------------------------------------------------
Write-Host ""
Write-Host "======================================" -ForegroundColor Magenta
Success "  Semua service sudah berjalan!"
Write-Host "======================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Frontend   " -NoNewline; Write-Host "http://localhost:5173" -ForegroundColor White
Write-Host "  Backend    " -NoNewline; Write-Host "http://localhost:8000/docs" -ForegroundColor White
Write-Host "  AI Service " -NoNewline; Write-Host "http://localhost:8001/docs" -ForegroundColor White
Write-Host "  AI Health  " -NoNewline; Write-Host "http://localhost:8001/health" -ForegroundColor White
Write-Host ""
Warn "  Tutup 3 jendela terminal untuk menghentikan semua service."
Write-Host ""

