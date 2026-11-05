#!/bin/bash
# ============================================================
#  SADEWA — Start All Services (macOS / Linux)
#  Jalankan: ./start.sh  (dari folder SADEWA/)
#
#  macOS : membuka 3 tab baru di Terminal (via osascript)
#  Linux : menjalankan 3 proses di background dalam satu terminal
# ============================================================

# Lokasi root (folder SADEWA/)
ROOT="$(cd "$(dirname "$0")" && pwd)"
VENV="$ROOT/../venv"
AI_DIR="$ROOT/ai"
BE_DIR="$ROOT/backend"
FE_DIR="$ROOT/frontend"

# Warna output
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
MAGENTA='\033[0;35m'
RED='\033[0;31m'
NC='\033[0m' # No Color

clear
echo -e "${MAGENTA}======================================"
echo -e "   SADEWA -- Starting All Services"
echo -e "======================================${NC}"
echo ""

# --- Cek venv ---------------------------------------------------
if [ ! -f "$VENV/bin/uvicorn" ]; then
    echo -e "${RED}[ERROR] venv tidak ditemukan di $VENV${NC}"
    echo "Jalankan dulu:"
    echo "  python3 -m venv venv"
    echo "  venv/bin/pip install -e 'SADEWA/ai[api]'"
    echo "  venv/bin/pip install -r SADEWA/backend/requirements.txt"
    exit 1
fi

# --- Cek node_modules -------------------------------------------
if [ ! -d "$FE_DIR/node_modules" ]; then
    echo -e "${YELLOW}[!] node_modules belum ada. Menjalankan npm install...${NC}"
    cd "$FE_DIR" && npm install --silent && cd "$ROOT"
fi

# ================================================================
# macOS — buka 3 tab Terminal baru via osascript
# ================================================================
if [[ "$OSTYPE" == "darwin"* ]]; then

    echo -e "${CYAN}[1/3] Memulai AI Service   -> http://localhost:8001${NC}"
    osascript <<EOF
tell application "Terminal"
    activate
    do script "echo '=== AI SERVICE (8001) ===' && cd '$AI_DIR' && '$VENV/bin/uvicorn' sadewa_ai.api:app --host 0.0.0.0 --port 8001 --reload"
end tell
EOF

    sleep 1

    echo -e "${GREEN}[2/3] Memulai Backend      -> http://localhost:8000${NC}"
    osascript <<EOF
tell application "Terminal"
    activate
    tell application "System Events" to keystroke "t" using command down
    do script "echo '=== BACKEND (8000) ===' && cd '$BE_DIR' && '$VENV/bin/uvicorn' app.main:app --host 0.0.0.0 --port 8000 --reload" in front window
end tell
EOF

    sleep 1

    echo -e "${YELLOW}[3/3] Memulai Frontend     -> http://localhost:5173${NC}"
    osascript <<EOF
tell application "Terminal"
    activate
    tell application "System Events" to keystroke "t" using command down
    do script "echo '=== FRONTEND (5173) ===' && cd '$FE_DIR' && npm run dev" in front window
end tell
EOF

# ================================================================
# Linux — jalankan di background, tampilkan log di satu terminal
# ================================================================
else

    echo -e "${CYAN}[1/3] Memulai AI Service   -> http://localhost:8001${NC}"
    "$VENV/bin/uvicorn" sadewa_ai.api:app \
        --host 0.0.0.0 --port 8001 --reload \
        --app-dir "$AI_DIR/src" \
        2>&1 | sed 's/^/[AI]  /' &
    PID_AI=$!

    sleep 2

    echo -e "${GREEN}[2/3] Memulai Backend      -> http://localhost:8000${NC}"
    cd "$BE_DIR"
    "$VENV/bin/uvicorn" app.main:app \
        --host 0.0.0.0 --port 8000 --reload \
        2>&1 | sed 's/^/[BE]  /' &
    PID_BE=$!
    cd "$ROOT"

    sleep 2

    echo -e "${YELLOW}[3/3] Memulai Frontend     -> http://localhost:5173${NC}"
    cd "$FE_DIR"
    npm run dev 2>&1 | sed 's/^/[FE]  /' &
    PID_FE=$!
    cd "$ROOT"

    # Tangkap Ctrl+C untuk matikan semua proses sekaligus
    trap "echo ''; echo 'Menghentikan semua service...'; kill $PID_AI $PID_BE $PID_FE 2>/dev/null; exit 0" SIGINT SIGTERM

fi

# --- Ringkasan --------------------------------------------------
echo ""
echo -e "${MAGENTA}======================================"
echo -e "  Semua service sudah berjalan!"
echo -e "======================================${NC}"
echo ""
echo -e "  Frontend   ${NC}http://localhost:5173"
echo -e "  Backend    ${NC}http://localhost:8000/docs"
echo -e "  AI Service ${NC}http://localhost:8001/docs"
echo -e "  AI Health  ${NC}http://localhost:8001/health"
echo ""

if [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "${YELLOW}  Tutup 3 tab Terminal untuk menghentikan semua service.${NC}"
else
    echo -e "${YELLOW}  Tekan Ctrl+C untuk menghentikan semua service.${NC}"
    # Tunggu semua background process
    wait $PID_AI $PID_BE $PID_FE
fi
echo ""

