#!/usr/bin/env bash
# scripts/setup-local-ai.sh
# Automated installer for Local AI (LFM3-1.7B + llama.cpp) for ADHDtools on macOS & Linux.
# Run from terminal:
#   bash scripts/setup-local-ai.sh
# Or as a one-liner:
#   curl -fsSL https://raw.githubusercontent.com/jobellet/ADHDtools/main/scripts/setup-local-ai.sh | bash

set -e

echo "=========================================================="
echo "   ADHDtools - Local AI Setup (LFM3 1.7B + llama.cpp)     "
echo "=========================================================="
echo ""

INSTALL_DIR="${HOME}/.local/share/llama-cpp"
mkdir -p "${INSTALL_DIR}"

MODEL_URL="https://huggingface.co/LiquidAI/LFM3-1.7B-GGUF/resolve/main/LFM3-1.7B-QAD-Q4_0.gguf"
MODEL_FILE="${INSTALL_DIR}/LFM3-1.7B-QAD-Q4_0.gguf"

# 1. Download llama.cpp binary based on OS and architecture
OS="$(uname -s)"
ARCH="$(uname -m)"

if [ ! -f "${INSTALL_DIR}/llama-server" ]; then
    echo "[1/2] Downloading llama.cpp binaries (~15-25 MB)..."
    TMP_ARCHIVE="/tmp/llama-cpp-bin.tar.gz"

    if [ "$OS" = "Darwin" ]; then
        if [ "$ARCH" = "arm64" ]; then
            ZIP_URL="https://github.com/ggerganov/llama.cpp/releases/download/b12019/llama-b12019-bin-macos-arm64.tar.gz"
        else
            ZIP_URL="https://github.com/ggerganov/llama.cpp/releases/download/b12019/llama-b12019-bin-macos-x64.tar.gz"
        fi
    elif [ "$OS" = "Linux" ]; then
        ZIP_URL="https://github.com/ggerganov/llama.cpp/releases/download/b12019/llama-b12019-bin-ubuntu-x64.tar.gz"
    else
        echo "Unsupported OS: $OS"
        exit 1
    fi

    curl -fsSL "$ZIP_URL" -o "$TMP_ARCHIVE"
    tar -xzf "$TMP_ARCHIVE" -C "$INSTALL_DIR"
    rm -f "$TMP_ARCHIVE"
    chmod +x "${INSTALL_DIR}/llama-server" || true
    echo "  -> llama.cpp installed in ${INSTALL_DIR}"
else
    echo "[1/2] llama.cpp is already installed in ${INSTALL_DIR}"
fi

# 2. Download LFM3-1.7B GGUF model
if [ ! -f "${MODEL_FILE}" ]; then
    echo "[2/2] Downloading Liquid AI LFM3-1.7B model (~1.05 GB)..."
    echo "      (This may take 1-3 minutes depending on your internet connection)"
    curl -L "$MODEL_URL" -o "$MODEL_FILE"
    echo "  -> Model saved to ${MODEL_FILE}"
else
    echo "[2/2] LFM3 model is already downloaded in ${INSTALL_DIR}"
fi

echo ""
echo "=========================================================="
echo "   Installation complete!                                "
echo "=========================================================="
echo ""
echo "How to use with ADHDtools:"
echo "1. Open the ADHDtools Desktop application."
echo "2. A button 'Local AI' / 'IA locale' will now appear in your header."
echo "3. Click it to start or stop the local server anytime."
echo "4. In ADHDtools Settings > AI Assistant, configure:"
echo "   - Provider: Custom / Local"
echo "   - Base URL: http://localhost:11434/v1"
echo "   - Model: lfm3"
echo ""
