#!/bin/bash
#
# ARI PII Scanner
#
# Scans the codebase for potentially personal information that shouldn't be committed.
# Run before commits: npm run scan:pii
#

set -e

RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "🔍 ARI PII Scanner"
echo "═══════════════════════════════════════"
echo ""

FOUND_PII=0

# Define patterns that should NOT be in committed code
# These are configured as examples - adjust for your specific patterns
PATTERNS=(
    # Personal identifiers (customize these)
    # Uncomment and customize with names to block:
    # "YourFirstName|YourLastName"

    # AWS keys (starts with AKIA)
    "AKIA[0-9A-Z]{16}"

    # Real API keys (longer than examples)
    "sk-[a-zA-Z0-9]{48}"
    "ghp_[a-zA-Z0-9]{36}"
)

# Files/directories to exclude from scanning
EXCLUDE_PATTERNS=(
    ".git"
    "node_modules"
    "dist"
    "coverage"
    "*.log"
    ".env*"
    "*.lock"
    "scripts/scan-pii.sh"  # Exclude this script
    "LICENSE"              # Creator credit belongs here
    "README.md"            # Creator credit belongs here
    "package.json"         # Author field belongs here
    "CLAUDE.md"            # Creator credit belongs here
    "CONTRIBUTING.md"      # May reference creator
    ".claude"              # Claude Code local config (not committed)
    "docs"                 # Documentation may contain example paths
    "tests"                # Test files may contain example paths
    "MAC-MINI-HANDOFF-PROMPT.md"  # Deployment docs with paths
)

# Build exclude arguments for grep
EXCLUDE_ARGS=""
for pattern in "${EXCLUDE_PATTERNS[@]}"; do
    EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude=$pattern --exclude-dir=$pattern"
done

# Scan each pattern
for pattern in "${PATTERNS[@]}"; do
    # Skip empty patterns
    if [[ -z "$pattern" ]]; then
        continue
    fi

    # Use grep -E for extended regex, -r for recursive, -n for line numbers
    # Exclude binary files and common non-source directories
    results=$(grep -rEn $EXCLUDE_ARGS "$pattern" . 2>/dev/null || true)

    if [[ -n "$results" ]]; then
        echo -e "${YELLOW}⚠️  Pattern match: ${pattern}${NC}"
        echo "$results" | head -10
        if [[ $(echo "$results" | wc -l) -gt 10 ]]; then
            echo "   ... and more"
        fi
        echo ""
        FOUND_PII=1
    fi
done

# Special check: Look for common personal directories in file paths
# Exclude generic placeholders like /Users/username/ or /home/user/
echo "Checking for hardcoded home directory paths..."
HOME_PATHS=$(grep -rEn "/Users/[a-z]+/|/home/[a-z]+/" . $EXCLUDE_ARGS 2>/dev/null \
    | grep -v "scripts/scan-pii.sh" \
    | grep -v "\${HOME}" \
    | grep -v "/Users/username" \
    | grep -v "/home/user" \
    | grep -v "\.example" \
    || true)
if [[ -n "$HOME_PATHS" ]]; then
    echo -e "${RED}❌ Found hardcoded home directory paths:${NC}"
    echo "$HOME_PATHS" | head -20
    FOUND_PII=1
fi

echo ""
echo "═══════════════════════════════════════"

if [[ $FOUND_PII -eq 1 ]]; then
    echo -e "${RED}❌ PII patterns detected. Review before committing.${NC}"
    echo ""
    echo "If these are false positives, you can:"
    echo "1. Add the pattern to EXCLUDE_PATTERNS in this script"
    echo "2. Use generic placeholders (e.g., \${HOME} instead of /Users/name)"
    exit 1
else
    echo -e "${GREEN}✅ No PII patterns detected.${NC}"
    exit 0
fi
