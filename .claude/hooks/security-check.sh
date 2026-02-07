#!/bin/bash
# Security hook for blocking dangerous patterns
# Exit 0 = allow, Exit 2 = block with message

set -euo pipefail

# Read tool input from stdin
INPUT=$(cat)

# Extract content (works for both Write and Edit tools)
CONTENT=$(echo "$INPUT" | jq -r '.content // .new_string // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.file_path // empty')

# Only check TypeScript and JavaScript files
if [[ ! "$FILE_PATH" =~ \.(ts|js|tsx|jsx)$ ]]; then
  exit 0
fi

# Check for external network bindings (IPv4 and IPv6)
if echo "$CONTENT" | grep -qE '0\.0\.0\.0|INADDR_ANY|::\/|::\"|::'\'''; then
  echo "SECURITY VIOLATION: Network binding must use 127.0.0.1, not 0.0.0.0 or ::"
  echo "File: $FILE_PATH"
  echo "See ADR-001: Loopback-Only Gateway"
  exit 2
fi

# Check for attempts to modify audit files directly
if [[ "$FILE_PATH" =~ audit\.json$ ]] || [[ "$FILE_PATH" =~ \.ari/audit ]]; then
  echo "SECURITY VIOLATION: Audit log is append-only and immutable"
  echo "File: $FILE_PATH"
  echo "See ADR-002: SHA-256 Hash Chain Audit"
  exit 2
fi

# Check for any type usage (excluding comments and strings)
# Simple check - may have false positives in edge cases
if echo "$CONTENT" | grep -qE ':\s*any\b|<any>|as\s+any\b'; then
  echo "TYPE VIOLATION: Use 'unknown' instead of 'any'"
  echo "File: $FILE_PATH"
  echo "See .claude/rules/typescript.md"
  exit 2
fi

# Check for hardcoded secrets patterns
if echo "$CONTENT" | grep -qiE 'api_key\s*=\s*["\x27][^"\x27]{20,}|password\s*=\s*["\x27][^"\x27]+["\x27]|secret\s*=\s*["\x27][^"\x27]{20,}'; then
  echo "SECURITY WARNING: Possible hardcoded secret detected"
  echo "File: $FILE_PATH"
  echo "Use environment variables or config instead"
  exit 2
fi

exit 0
