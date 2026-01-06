#!/bin/bash

# Development script for running Electron with SvelteKit
# This starts Vite dev server and Electron separately to avoid electron-forge issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo -e "${GREEN}Starting development environment...${NC}"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down...${NC}"
    if [ ! -z "$VITE_PID" ]; then
        kill $VITE_PID 2>/dev/null || true
    fi
    if [ ! -z "$ELECTRON_PID" ]; then
        kill $ELECTRON_PID 2>/dev/null || true
    fi
    # Kill any remaining Electron processes from this session
    pkill -f "Electron.app.*$PROJECT_DIR" 2>/dev/null || true
    echo -e "${GREEN}Cleanup complete.${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Build main process
echo -e "${YELLOW}Building main process...${NC}"
npx vite build --config vite.main.config.ts --mode development
npx vite build --config vite.preload.config.ts --mode development

# Start Vite dev server
echo -e "${YELLOW}Starting Vite dev server...${NC}"
pnpm vite dev --port 5173 &
VITE_PID=$!

# Wait for Vite to be ready
echo -e "${YELLOW}Waiting for Vite server to be ready...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo -e "${GREEN}Vite server is ready!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}Timeout waiting for Vite server${NC}"
        exit 1
    fi
    sleep 0.5
done

# Start Electron
echo -e "${YELLOW}Starting Electron...${NC}"
node_modules/.bin/electron .vite/build/main.js &
ELECTRON_PID=$!

echo -e "${GREEN}Development environment started!${NC}"
echo -e "  Vite: http://localhost:5173"
echo -e "  Press Ctrl+C to stop"

# Wait for Electron to exit
wait $ELECTRON_PID 2>/dev/null || true
