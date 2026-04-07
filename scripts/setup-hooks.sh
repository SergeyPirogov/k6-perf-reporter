#!/bin/bash

# Setup script for git hooks
# Run this after cloning: bash scripts/setup-hooks.sh

echo "🔧 Setting up git hooks..."

# Configure git to use .githooks directory
git config core.hooksPath .githooks

# Make all hook files executable
chmod +x .githooks/*

echo "✅ Git hooks configured!"
echo ""
echo "Available hooks:"
echo "  - pre-commit: Runs ESLint before each commit"
echo ""
echo "Hooks are now active. To bypass hooks (not recommended):"
echo "  git commit --no-verify"
