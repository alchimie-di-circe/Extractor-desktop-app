#!/bin/bash
# Build Cagent sidecar standalone executable with PyInstaller
# 
# Usage: ./scripts/build-sidecar.sh
# 
# Output: resources/sidecar/cagent-sidecar (macOS/Linux)
#         resources/sidecar/cagent-sidecar.exe (Windows)

set -e

echo "=== Building Cagent Sidecar ==="

# Change to project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Create virtual environment if it doesn't exist
if [ ! -d "python/.venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv python/.venv
fi

# Activate virtual environment
source python/.venv/bin/activate || . python/.venv/Scripts/activate

# Install dependencies
echo "Installing Python dependencies..."
pip install -q -r python/requirements.txt
pip install -q pyinstaller

# Build sidecar
echo "Building sidecar executable..."
cd python
pyinstaller --clean --noconfirm pyinstaller.spec

# Create output directory
mkdir -p "$PROJECT_ROOT/resources/sidecar"

# Copy executable to resources
if [ -f "dist/cagent-sidecar" ]; then
    echo "Copying executable to resources/sidecar/"
    cp -v dist/cagent-sidecar "$PROJECT_ROOT/resources/sidecar/"
    chmod +x "$PROJECT_ROOT/resources/sidecar/cagent-sidecar"
elif [ -f "dist/cagent-sidecar.exe" ]; then
    echo "Copying executable to resources/sidecar/"
    cp -v dist/cagent-sidecar.exe "$PROJECT_ROOT/resources/sidecar/"
else
    echo "ERROR: Sidecar executable not found in dist/"
    exit 1
fi

# Get file size
SIDECAR_PATH="$PROJECT_ROOT/resources/sidecar/cagent-sidecar"
if [ -f "$SIDECAR_PATH" ]; then
    SIZE=$(ls -lh "$SIDECAR_PATH" | awk '{print $5}')
    echo "✓ Sidecar built successfully (Size: $SIZE)"
elif [ -f "$PROJECT_ROOT/resources/sidecar/cagent-sidecar.exe" ]; then
    SIDECAR_PATH="$PROJECT_ROOT/resources/sidecar/cagent-sidecar.exe"
    SIZE=$(ls -lh "$SIDECAR_PATH" | awk '{print $5}')
    echo "✓ Sidecar built successfully (Size: $SIZE)"
else
    echo "ERROR: Final copy failed"
    exit 1
fi

# Deactivate virtual environment
deactivate || true

echo "=== Build complete ==="
