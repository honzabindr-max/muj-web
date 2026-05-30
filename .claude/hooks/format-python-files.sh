#!/usr/bin/env bash
file_path=$(jq -r '.tool_input.file_path // empty')
if [[ "$file_path" =~ \.py$ ]]; then
  python3 -m black "$file_path" 2>/dev/null || true
fi
