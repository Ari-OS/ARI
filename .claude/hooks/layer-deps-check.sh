#!/bin/bash
# Layer dependency validation hook
# Exit 0 = allow, Exit 2 = block with message

set -euo pipefail

INPUT=$(cat)
CONTENT=$(echo "$INPUT" | jq -r '.content // .new_string // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.file_path // empty')

# Only check TypeScript files
if [[ ! "$FILE_PATH" =~ \.ts$ ]]; then
  exit 0
fi

# Determine file's layer from path
get_layer() {
  case "$1" in
    *"/cognitive/"*) echo 0 ;;
    *"/kernel/"*) echo 1 ;;
    *"/system/"*) echo 2 ;;
    *"/agents/"*) echo 3 ;;
    *"/governance/"*) echo 4 ;;
    *"/ops/"*) echo 5 ;;
    *"/cli/"*|*"/dashboard/"*) echo 6 ;;
    *) echo -1 ;;
  esac
}

FILE_LAYER=$(get_layer "$FILE_PATH")

# Skip if not in a known layer
if [[ "$FILE_LAYER" == "-1" ]]; then
  exit 0
fi

# Layer 0 (Cognitive) cannot import from any other layer
if [[ "$FILE_LAYER" == "0" ]]; then
  if echo "$CONTENT" | grep -qE "from\s*['\"]\.\./(kernel|system|agents|governance|ops|cli|dashboard)/"; then
    echo "LAYER VIOLATION: L0 Cognitive cannot import from any other layer"
    echo "File: $FILE_PATH"
    echo "L0 must be self-contained with no external dependencies"
    echo "See .claude/rules/architecture.md"
    exit 2
  fi
fi

# Check for imports from higher layers
check_import() {
  local import_path="$1"
  local import_layer=-1

  case "$import_path" in
    *"/cli/"*|*"/dashboard/"*|*"../cli/"*|*"../dashboard/"*) import_layer=6 ;;
    *"/ops/"*|*"../ops/"*) import_layer=5 ;;
    *"/governance/"*|*"../governance/"*) import_layer=4 ;;
    *"/agents/"*|*"../agents/"*) import_layer=3 ;;
    *"/system/"*|*"../system/"*) import_layer=2 ;;
    *"/kernel/"*|*"../kernel/"*) import_layer=1 ;;
    *"/cognitive/"*|*"../cognitive/"*) import_layer=0 ;;
  esac

  if [[ "$import_layer" -gt "$FILE_LAYER" && "$import_layer" -ne -1 ]]; then
    echo "LAYER VIOLATION: L$FILE_LAYER cannot import from L$import_layer"
    echo "File: $FILE_PATH"
    echo "Import: $import_path"
    echo "Rule: Lower layers cannot import from higher layers"
    echo "See .claude/rules/architecture.md"
    exit 2
  fi
}

# Extract imports (both single and double quotes)
while IFS= read -r line; do
  # Match: import ... from 'path' or import ... from "path"
  if [[ "$line" =~ from[[:space:]]*[\'\"]([^\'\"]+)[\'\"] ]]; then
    check_import "${BASH_REMATCH[1]}"
  fi
done <<< "$CONTENT"

exit 0
