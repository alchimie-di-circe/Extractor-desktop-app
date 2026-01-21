#!/usr/bin/env bash
set -e

echo "=========================================="
echo "  Pre-PR Quality Check"
echo "=========================================="
echo ""

echo "[1/4] Running lint check..."
pnpm run lint || { echo "Lint failed!"; exit 1; }
echo "Lint passed."
echo ""

echo "[2/4] Running type check..."
pnpm run check || { echo "Type check failed!"; exit 1; }
echo "Type check passed."
echo ""

echo "[3/4] Running unit tests..."
pnpm run test:unit -- --run || { echo "Unit tests failed!"; exit 1; }
echo "Unit tests passed."
echo ""

echo "[4/4] Running build verification..."
pnpm run package || { echo "Build failed!"; exit 1; }
echo "Build passed."
echo ""

echo "=========================================="
echo "  All checks passed! Ready for PR"
echo "=========================================="
