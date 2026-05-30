#!/usr/bin/env bash
file_path=$(jq -r '.tool_input.file_path // empty')
if [[ "$file_path" =~ \.(js|jsx|ts|tsx|mjs|cjs|css|scss)$ ]]; then
  npx --no-install prettier --write "$file_path" 2>/dev/null || true
fi
