#!/bin/bash
set -euo pipefail

echo "=== Google Workspace MCP: Build & Package ==="
rm -rf dist/
NODE_ENV=production node esbuild.config.mjs
npx tsc --noEmit
npx @vscode/vsce package --no-dependencies
echo "=== Done: google-workspace-mcp-*.vsix ==="
