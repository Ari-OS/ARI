#!/bin/bash
#===============================================================================
# ARI V11.0 TEST SCRIPT
# Run system tests and validation
#===============================================================================

set -uo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${ROOT_DIR}/logs/test_${TIMESTAMP}.log"
RESULTS_FILE="${ROOT_DIR}/data/test_results_${TIMESTAMP}.json"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Options
VERBOSE=false
QUIET=false
FAIL_FAST=false
TEST_SUITE="all"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

#-------------------------------------------------------------------------------
# Logging
#-------------------------------------------------------------------------------
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    mkdir -p "$(dirname "$LOG_FILE")"
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

output() {
    if [[ "$QUIET" != true ]]; then
        echo "$@"
    fi
}

test_pass() {
    ((TESTS_RUN++))
    ((TESTS_PASSED++))
    log PASS "$1"
    if [[ "$QUIET" != true ]]; then
        echo -e "  ${GREEN}✓${NC} $1"
    fi
}

test_fail() {
    ((TESTS_RUN++))
    ((TESTS_FAILED++))
    log FAIL "$1"
    if [[ "$QUIET" != true ]]; then
        echo -e "  ${RED}✗${NC} $1"
        if [[ -n "${2:-}" ]]; then
            echo -e "    ${RED}→ $2${NC}"
        fi
    fi
    
    if [[ "$FAIL_FAST" == true ]]; then
        output ""
        output "FAIL_FAST enabled, stopping tests"
        print_summary
        exit 1
    fi
}

test_skip() {
    ((TESTS_RUN++))
    ((TESTS_SKIPPED++))
    log SKIP "$1"
    if [[ "$VERBOSE" == true ]]; then
        echo -e "  ${YELLOW}○${NC} $1 (skipped)"
    fi
}

#-------------------------------------------------------------------------------
# Parse arguments
#-------------------------------------------------------------------------------
show_help() {
    cat << EOF
Usage: $0 [OPTIONS] [TEST_SUITE]

Run ARI system tests.

Options:
  -v, --verbose         Show detailed output
  -q, --quiet           Minimal output (only summary)
  -f, --fail-fast       Stop on first failure
  --json                Output results as JSON
  -h, --help            Show this help

Test Suites:
  all                   Run all tests (default)
  structure             Directory and file structure tests
  config                Configuration validation tests
  schema                JSON schema validation tests
  integration           Integration tests
  security              Security validation tests

Examples:
  $0                    # Run all tests
  $0 structure          # Run structure tests only
  $0 -v --fail-fast     # Verbose with fail-fast
EOF
}

JSON_OUTPUT=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -q|--quiet)
            QUIET=true
            shift
            ;;
        -f|--fail-fast)
            FAIL_FAST=true
            shift
            ;;
        --json)
            JSON_OUTPUT=true
            QUIET=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        all|structure|config|schema|integration|security)
            TEST_SUITE="$1"
            shift
            ;;
        -*)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
        *)
            echo "Unknown test suite: $1"
            show_help
            exit 1
            ;;
    esac
done

#-------------------------------------------------------------------------------
# Test: Directory Structure
#-------------------------------------------------------------------------------
test_structure() {
    output ""
    output -e "${CYAN}Directory Structure Tests${NC}"
    output "─────────────────────────"
    
    # Required directories
    local required_dirs=(
        "SYSTEM"
        "COUNCIL"
        "AGENTS/DOMAIN"
        "AGENTS/EXECUTION"
        "SCHEMAS"
        "CONFIG"
        "WORKFLOWS"
        "PLAYBOOKS"
        "TEMPLATES"
        "SCRIPTS"
        "DOCS"
    )
    
    for dir in "${required_dirs[@]}"; do
        if [[ -d "${ROOT_DIR}/${dir}" ]]; then
            test_pass "Directory exists: $dir"
        else
            test_fail "Directory missing: $dir"
        fi
    done
    
    # Required files
    local required_files=(
        "SYSTEM/CORE_IDENTITY.md"
        "SYSTEM/CONSTITUTION.md"
        "SYSTEM/ROUTER.md"
        "SYSTEM/PLANNER.md"
        "SYSTEM/EXECUTOR.md"
        "SYSTEM/GUARDIAN.md"
        "SYSTEM/MEMORY_MANAGER.md"
        "CONFIG/defaults.json"
        "CONFIG/permissions.json"
    )
    
    for file in "${required_files[@]}"; do
        if [[ -f "${ROOT_DIR}/${file}" ]]; then
            test_pass "File exists: $file"
        else
            test_fail "File missing: $file"
        fi
    done
}

#-------------------------------------------------------------------------------
# Test: Configuration Validation
#-------------------------------------------------------------------------------
test_config() {
    output ""
    output -e "${CYAN}Configuration Tests${NC}"
    output "───────────────────"
    
    if ! command -v jq &> /dev/null; then
        test_skip "jq not installed - skipping JSON validation"
        return
    fi
    
    local config_files=(
        "defaults.json"
        "permissions.json"
        "allowlists.json"
        "retention.json"
        "safe_defaults.json"
    )
    
    for config in "${config_files[@]}"; do
        local path="${ROOT_DIR}/CONFIG/${config}"
        if [[ -f "$path" ]]; then
            if jq empty "$path" 2>/dev/null; then
                test_pass "Valid JSON: $config"
                
                # Additional validation for specific files
                case "$config" in
                    defaults.json)
                        if jq -e '.system' "$path" &>/dev/null; then
                            test_pass "defaults.json has system section"
                        else
                            test_fail "defaults.json missing system section"
                        fi
                        ;;
                    permissions.json)
                        if jq -e '.permission_levels' "$path" &>/dev/null; then
                            test_pass "permissions.json has permission_levels"
                        else
                            test_fail "permissions.json missing permission_levels"
                        fi
                        ;;
                esac
            else
                test_fail "Invalid JSON: $config" "$(jq empty "$path" 2>&1)"
            fi
        else
            test_fail "Config missing: $config"
        fi
    done
}

#-------------------------------------------------------------------------------
# Test: JSON Schema Validation
#-------------------------------------------------------------------------------
test_schema() {
    output ""
    output -e "${CYAN}Schema Tests${NC}"
    output "────────────"
    
    if ! command -v jq &> /dev/null; then
        test_skip "jq not installed - skipping schema validation"
        return
    fi
    
    local schema_files=(
        "event.json"
        "memory_entry.json"
        "tool_call.json"
        "config.json"
    )
    
    for schema in "${schema_files[@]}"; do
        local path="${ROOT_DIR}/SCHEMAS/${schema}"
        if [[ -f "$path" ]]; then
            if jq empty "$path" 2>/dev/null; then
                test_pass "Valid schema: $schema"
                
                # Check for required schema fields
                if jq -e '."$schema"' "$path" &>/dev/null; then
                    test_pass "$schema has \$schema reference"
                else
                    test_fail "$schema missing \$schema reference"
                fi
                
                if jq -e '.type' "$path" &>/dev/null; then
                    test_pass "$schema has type definition"
                else
                    test_fail "$schema missing type definition"
                fi
            else
                test_fail "Invalid schema: $schema"
            fi
        else
            test_fail "Schema missing: $schema"
        fi
    done
}

#-------------------------------------------------------------------------------
# Test: Integration Tests
#-------------------------------------------------------------------------------
test_integration() {
    output ""
    output -e "${CYAN}Integration Tests${NC}"
    output "─────────────────"
    
    # Test script executability
    local scripts=(
        "bootstrap.sh"
        "health_check.sh"
        "backup.sh"
        "restore.sh"
        "deploy.sh"
        "rollback.sh"
        "test.sh"
    )
    
    for script in "${scripts[@]}"; do
        local path="${SCRIPT_DIR}/${script}"
        if [[ -f "$path" ]]; then
            if [[ -x "$path" ]]; then
                test_pass "Script executable: $script"
            else
                test_fail "Script not executable: $script"
            fi
        else
            test_fail "Script missing: $script"
        fi
    done
    
    # Test health check runs
    local health_script="${SCRIPT_DIR}/health_check.sh"
    if [[ -x "$health_script" ]]; then
        "$health_script" --quiet &>/dev/null
        local hc_exit=$?
        # Accept exit 0 (success) or 2 (warnings only)
        if [[ $hc_exit -eq 0 || $hc_exit -eq 2 ]]; then
            test_pass "Health check executes successfully"
        else
            test_fail "Health check reports failures"
        fi
    fi
    
    # Test governance system files exist (in SYSTEM/)
    local governance=("ARBITER" "OVERSEER")
    for member in "${governance[@]}"; do
        if [[ -f "${ROOT_DIR}/SYSTEM/${member}.md" ]]; then
            test_pass "Governance: ${member}"
        else
            test_fail "Governance missing: ${member}"
        fi
    done
    
    # Test council review members exist (in COUNCIL/)
    local council_members=("ARCHITECT" "SECURITY" "RELIABILITY_OPS" "PRODUCT_UX" "RESEARCH")
    for member in "${council_members[@]}"; do
        if [[ -f "${ROOT_DIR}/COUNCIL/${member}.md" ]]; then
            test_pass "Council reviewer: ${member}"
        else
            test_fail "Council reviewer missing: ${member}"
        fi
    done
    
    # Test domain agents exist
    local domain_agents=("RESEARCH" "MARKETING" "SALES" "CONTENT" "SEO")
    for agent in "${domain_agents[@]}"; do
        if [[ -f "${ROOT_DIR}/AGENTS/DOMAIN/${agent}.md" ]]; then
            test_pass "Domain agent: ${agent}"
        else
            test_fail "Domain agent missing: ${agent}"
        fi
    done
    
    # Test execution agents exist
    local exec_agents=("BUILD" "DEVELOPMENT" "CLIENT_COMMS" "STRATEGY" "PIPELINE" "LEARNING")
    for agent in "${exec_agents[@]}"; do
        if [[ -f "${ROOT_DIR}/AGENTS/EXECUTION/${agent}.md" ]]; then
            test_pass "Execution agent: ${agent}"
        else
            test_fail "Execution agent missing: ${agent}"
        fi
    done
}

#-------------------------------------------------------------------------------
# Test: Security Validation
#-------------------------------------------------------------------------------
test_security() {
    output ""
    output -e "${CYAN}Security Tests${NC}"
    output "──────────────"
    
    # Check Guardian exists
    if [[ -f "${ROOT_DIR}/SYSTEM/GUARDIAN.md" ]]; then
        test_pass "Guardian system file exists"
        
        # Check Guardian has security sections
        if grep -q "THREAT DETECTION" "${ROOT_DIR}/SYSTEM/GUARDIAN.md" 2>/dev/null; then
            test_pass "Guardian has threat detection"
        else
            test_fail "Guardian missing threat detection section"
        fi
    else
        test_fail "Guardian system file missing"
    fi
    
    # Check security playbooks exist
    local security_playbooks=(
        "prompt_injection.md"
        "memory_poisoning.md"
    )
    
    for playbook in "${security_playbooks[@]}"; do
        if [[ -f "${ROOT_DIR}/PLAYBOOKS/${playbook}" ]]; then
            test_pass "Security playbook: $playbook"
        else
            test_fail "Security playbook missing: $playbook"
        fi
    done
    
    # Check allowlists configuration
    local allowlists="${ROOT_DIR}/CONFIG/allowlists.json"
    if [[ -f "$allowlists" ]] && command -v jq &> /dev/null; then
        if jq -e '.domains.blocked' "$allowlists" &>/dev/null; then
            test_pass "Allowlists has blocked domains"
        else
            test_fail "Allowlists missing blocked domains"
        fi
        
        if jq -e '.prompt_patterns.block_immediately' "$allowlists" &>/dev/null; then
            test_pass "Allowlists has prompt blocking patterns"
        else
            test_fail "Allowlists missing prompt blocking patterns"
        fi
    fi
    
    # Check safe defaults exist
    if [[ -f "${ROOT_DIR}/CONFIG/safe_defaults.json" ]]; then
        test_pass "Safe defaults configuration exists"
    else
        test_fail "Safe defaults configuration missing"
    fi
    
    # Check Constitution exists and has principles
    if [[ -f "${ROOT_DIR}/SYSTEM/CONSTITUTION.md" ]]; then
        if grep -q "PRINCIPLES" "${ROOT_DIR}/SYSTEM/CONSTITUTION.md" 2>/dev/null; then
            test_pass "Constitution has principles"
        else
            test_fail "Constitution missing principles section"
        fi
    else
        test_fail "Constitution file missing"
    fi
}

#-------------------------------------------------------------------------------
# Print Summary
#-------------------------------------------------------------------------------
print_summary() {
    output ""
    output "═══════════════════════════════════════════════════════════════════════════════"
    output "TEST SUMMARY"
    output "═══════════════════════════════════════════════════════════════════════════════"
    output ""
    
    echo -e "  ${GREEN}Passed:${NC}  $TESTS_PASSED"
    echo -e "  ${RED}Failed:${NC}  $TESTS_FAILED"
    echo -e "  ${YELLOW}Skipped:${NC} $TESTS_SKIPPED"
    echo "  ─────────────────"
    echo "  Total:   $TESTS_RUN"
    
    output ""
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}All tests passed!${NC}"
    else
        echo -e "${RED}$TESTS_FAILED test(s) failed${NC}"
    fi
    
    output ""
}

#-------------------------------------------------------------------------------
# Generate JSON results
#-------------------------------------------------------------------------------
generate_json_results() {
    local status="pass"
    if [[ $TESTS_FAILED -gt 0 ]]; then
        status="fail"
    fi
    
    cat << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "status": "$status",
  "suite": "$TEST_SUITE",
  "results": {
    "total": $TESTS_RUN,
    "passed": $TESTS_PASSED,
    "failed": $TESTS_FAILED,
    "skipped": $TESTS_SKIPPED
  },
  "version": "11.0.0"
}
EOF
}

#-------------------------------------------------------------------------------
# Main execution
#-------------------------------------------------------------------------------
main() {
    if [[ "$QUIET" != true ]]; then
        echo ""
        echo "==============================================================================="
        echo "ARI V11.0 TEST SUITE"
        echo "==============================================================================="
        echo ""
        echo "Running: $TEST_SUITE tests"
    fi
    
    # Run appropriate test suite
    case "$TEST_SUITE" in
        all)
            test_structure
            test_config
            test_schema
            test_integration
            test_security
            ;;
        structure)
            test_structure
            ;;
        config)
            test_config
            ;;
        schema)
            test_schema
            ;;
        integration)
            test_integration
            ;;
        security)
            test_security
            ;;
    esac
    
    # Output results
    if [[ "$JSON_OUTPUT" == true ]]; then
        generate_json_results
    else
        print_summary
    fi
    
    # Save results
    mkdir -p "$(dirname "$RESULTS_FILE")"
    generate_json_results > "$RESULTS_FILE"
    
    # Exit with appropriate code
    if [[ $TESTS_FAILED -gt 0 ]]; then
        exit 1
    else
        exit 0
    fi
}

main "$@"
