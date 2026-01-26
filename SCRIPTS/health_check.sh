#!/bin/bash
#===============================================================================
# ARI V11.0 HEALTH CHECK SCRIPT
# Verify system health and report status
#===============================================================================

set -uo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_DIR="${ROOT_DIR}/CONFIG"
DATA_DIR="${ROOT_DIR}/data"

# Options
QUIET=false
VERBOSE=false
JSON_OUTPUT=false

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNED=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

#-------------------------------------------------------------------------------
# Parse arguments
#-------------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case $1 in
        -q|--quiet)
            QUIET=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --json)
            JSON_OUTPUT=true
            QUIET=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -q, --quiet    Minimal output (exit code only)"
            echo "  -v, --verbose  Detailed output"
            echo "  --json         Output results as JSON"
            echo "  -h, --help     Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

#-------------------------------------------------------------------------------
# Output functions
#-------------------------------------------------------------------------------
output() {
    if [[ "$QUIET" != true ]]; then
        echo "$@"
    fi
}

check_pass() {
    ((CHECKS_PASSED++))
    if [[ "$QUIET" != true ]]; then
        echo -e "${GREEN}[PASS]${NC} $1"
    fi
}

check_fail() {
    ((CHECKS_FAILED++))
    if [[ "$QUIET" != true ]]; then
        echo -e "${RED}[FAIL]${NC} $1"
    fi
}

check_warn() {
    ((CHECKS_WARNED++))
    if [[ "$QUIET" != true ]]; then
        echo -e "${YELLOW}[WARN]${NC} $1"
    fi
}

check_info() {
    if [[ "$VERBOSE" == true ]]; then
        echo -e "${BLUE}[INFO]${NC} $1"
    fi
}

#-------------------------------------------------------------------------------
# Directory structure checks
#-------------------------------------------------------------------------------
check_directories() {
    output ""
    output "=== Directory Structure ==="
    
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
    )
    
    for dir in "${required_dirs[@]}"; do
        if [[ -d "${ROOT_DIR}/${dir}" ]]; then
            check_pass "Directory exists: $dir"
        else
            check_fail "Directory missing: $dir"
        fi
    done
    
    # Check data directories (may not exist before bootstrap)
    local data_dirs=("data" "data/memory" "data/backups" "logs")
    for dir in "${data_dirs[@]}"; do
        if [[ -d "${ROOT_DIR}/${dir}" ]]; then
            check_pass "Data directory exists: $dir"
        else
            check_warn "Data directory missing (run bootstrap): $dir"
        fi
    done
}

#-------------------------------------------------------------------------------
# Core file checks
#-------------------------------------------------------------------------------
check_core_files() {
    output ""
    output "=== Core System Files ==="
    
    local core_files=(
        "SYSTEM/CORE_IDENTITY.md"
        "SYSTEM/CONSTITUTION.md"
        "SYSTEM/ROUTER.md"
        "SYSTEM/PLANNER.md"
        "SYSTEM/EXECUTOR.md"
        "SYSTEM/GUARDIAN.md"
        "SYSTEM/MEMORY_MANAGER.md"
    )
    
    for file in "${core_files[@]}"; do
        if [[ -f "${ROOT_DIR}/${file}" ]]; then
            check_pass "Core file exists: $file"
            
            # Check file is not empty
            if [[ ! -s "${ROOT_DIR}/${file}" ]]; then
                check_warn "File is empty: $file"
            fi
        else
            check_fail "Core file missing: $file"
        fi
    done
}

#-------------------------------------------------------------------------------
# Governance checks
#-------------------------------------------------------------------------------
check_governance() {
    output ""
    output "=== Governance (SYSTEM/) ==="
    
    local governance=(
        "ARBITER.md"
        "OVERSEER.md"
    )
    
    for member in "${governance[@]}"; do
        if [[ -f "${ROOT_DIR}/SYSTEM/${member}" ]]; then
            check_pass "Governance: $member"
        else
            check_fail "Governance missing: $member"
        fi
    done
}

#-------------------------------------------------------------------------------
# Council reviewer checks
#-------------------------------------------------------------------------------
check_council() {
    output ""
    output "=== Council Reviewers ==="
    
    local council_members=(
        "ARCHITECT.md"
        "SECURITY.md"
        "RELIABILITY_OPS.md"
        "PRODUCT_UX.md"
        "RESEARCH.md"
    )
    
    for member in "${council_members[@]}"; do
        if [[ -f "${ROOT_DIR}/COUNCIL/${member}" ]]; then
            check_pass "Council reviewer: $member"
        else
            check_fail "Council reviewer missing: $member"
        fi
    done
}

#-------------------------------------------------------------------------------
# Agent checks
#-------------------------------------------------------------------------------
check_agents() {
    output ""
    output "=== Domain Agents ==="
    
    local domain_agents=(
        "RESEARCH.md"
        "MARKETING.md"
        "SALES.md"
        "CONTENT.md"
        "SEO.md"
    )
    
    for agent in "${domain_agents[@]}"; do
        if [[ -f "${ROOT_DIR}/AGENTS/DOMAIN/${agent}" ]]; then
            check_pass "Domain agent: $agent"
        else
            check_fail "Domain agent missing: $agent"
        fi
    done
    
    output ""
    output "=== Execution Agents ==="
    
    local exec_agents=(
        "BUILD.md"
        "DEVELOPMENT.md"
        "CLIENT_COMMS.md"
        "STRATEGY.md"
        "PIPELINE.md"
        "LEARNING.md"
    )
    
    for agent in "${exec_agents[@]}"; do
        if [[ -f "${ROOT_DIR}/AGENTS/EXECUTION/${agent}" ]]; then
            check_pass "Execution agent: $agent"
        else
            check_fail "Execution agent missing: $agent"
        fi
    done
}

#-------------------------------------------------------------------------------
# Schema validation
#-------------------------------------------------------------------------------
check_schemas() {
    output ""
    output "=== JSON Schemas ==="
    
    if ! command -v jq &> /dev/null; then
        check_warn "jq not installed - skipping JSON validation"
        return
    fi
    
    local schema_files=(
        "event.json"
        "memory_entry.json"
        "tool_call.json"
        "config.json"
    )
    
    for schema in "${schema_files[@]}"; do
        local schema_path="${ROOT_DIR}/SCHEMAS/${schema}"
        if [[ -f "$schema_path" ]]; then
            if jq empty "$schema_path" 2>/dev/null; then
                check_pass "Schema valid: $schema"
            else
                check_fail "Schema invalid: $schema"
            fi
        else
            check_fail "Schema missing: $schema"
        fi
    done
}

#-------------------------------------------------------------------------------
# Configuration checks
#-------------------------------------------------------------------------------
check_config() {
    output ""
    output "=== Configuration ==="
    
    local config_files=(
        "defaults.json"
        "permissions.json"
        "allowlists.json"
        "retention.json"
        "safe_defaults.json"
    )
    
    for config in "${config_files[@]}"; do
        local config_path="${CONFIG_DIR}/${config}"
        if [[ -f "$config_path" ]]; then
            if command -v jq &> /dev/null; then
                if jq empty "$config_path" 2>/dev/null; then
                    check_pass "Config valid: $config"
                else
                    check_fail "Config invalid JSON: $config"
                fi
            else
                check_pass "Config exists: $config"
            fi
        else
            check_fail "Config missing: $config"
        fi
    done
    
    # Check for active config
    if [[ -f "${CONFIG_DIR}/active_config.json" ]]; then
        check_pass "Active configuration exists"
    else
        check_warn "No active configuration (run bootstrap)"
    fi
}

#-------------------------------------------------------------------------------
# Memory store checks
#-------------------------------------------------------------------------------
check_memory() {
    output ""
    output "=== Memory Store ==="
    
    local memory_file="${DATA_DIR}/memory/core_memory.json"
    
    if [[ -f "$memory_file" ]]; then
        check_pass "Memory store exists"
        
        if command -v jq &> /dev/null; then
            if jq empty "$memory_file" 2>/dev/null; then
                check_pass "Memory store is valid JSON"
                
                # Check entry count
                local entry_count=$(jq '.entries | length' "$memory_file" 2>/dev/null || echo "0")
                check_info "Memory entries: $entry_count"
            else
                check_fail "Memory store is corrupted"
            fi
        fi
    else
        check_warn "Memory store not initialized (run bootstrap)"
    fi
}

#-------------------------------------------------------------------------------
# Disk space check
#-------------------------------------------------------------------------------
check_disk_space() {
    output ""
    output "=== Disk Space ==="
    
    local available_kb=$(df -k "$ROOT_DIR" 2>/dev/null | awk 'NR==2 {print $4}')
    
    if [[ -n "$available_kb" ]]; then
        local available_mb=$((available_kb / 1024))
        
        if [[ $available_mb -gt 1000 ]]; then
            check_pass "Disk space: ${available_mb}MB available"
        elif [[ $available_mb -gt 100 ]]; then
            check_warn "Disk space low: ${available_mb}MB available"
        else
            check_fail "Disk space critical: ${available_mb}MB available"
        fi
    else
        check_warn "Could not determine disk space"
    fi
}

#-------------------------------------------------------------------------------
# File permissions check
#-------------------------------------------------------------------------------
check_permissions() {
    output ""
    output "=== File Permissions ==="
    
    # Check scripts are executable
    local scripts_ok=true
    for script in "${SCRIPT_DIR}"/*.sh; do
        if [[ -f "$script" ]]; then
            if [[ -x "$script" ]]; then
                check_info "Executable: $(basename "$script")"
            else
                check_warn "Not executable: $(basename "$script")"
                scripts_ok=false
            fi
        fi
    done
    
    if [[ "$scripts_ok" == true ]]; then
        check_pass "All scripts are executable"
    fi
    
    # Check sensitive directories
    if [[ -d "${DATA_DIR}" ]]; then
        local data_perms=$(stat -c %a "${DATA_DIR}" 2>/dev/null || stat -f %A "${DATA_DIR}" 2>/dev/null)
        if [[ "$data_perms" =~ ^7[05]0$ ]]; then
            check_pass "Data directory permissions are secure"
        else
            check_warn "Data directory permissions may be too open: $data_perms"
        fi
    fi
}

#-------------------------------------------------------------------------------
# Generate JSON report
#-------------------------------------------------------------------------------
generate_json_report() {
    local status="healthy"
    if [[ $CHECKS_FAILED -gt 0 ]]; then
        status="unhealthy"
    elif [[ $CHECKS_WARNED -gt 0 ]]; then
        status="degraded"
    fi
    
    cat << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "status": "$status",
  "checks": {
    "passed": $CHECKS_PASSED,
    "failed": $CHECKS_FAILED,
    "warnings": $CHECKS_WARNED
  },
  "version": "11.0.0"
}
EOF
}

#-------------------------------------------------------------------------------
# Print summary
#-------------------------------------------------------------------------------
print_summary() {
    output ""
    output "==============================================================================="
    output "HEALTH CHECK SUMMARY"
    output "==============================================================================="
    output ""
    
    local total=$((CHECKS_PASSED + CHECKS_FAILED + CHECKS_WARNED))
    
    echo -e "  ${GREEN}Passed:${NC}   $CHECKS_PASSED"
    echo -e "  ${RED}Failed:${NC}   $CHECKS_FAILED"
    echo -e "  ${YELLOW}Warnings:${NC} $CHECKS_WARNED"
    echo "  ─────────────────"
    echo "  Total:    $total"
    output ""
    
    if [[ $CHECKS_FAILED -eq 0 && $CHECKS_WARNED -eq 0 ]]; then
        echo -e "${GREEN}System is healthy!${NC}"
    elif [[ $CHECKS_FAILED -eq 0 ]]; then
        echo -e "${YELLOW}System has warnings - review recommended${NC}"
    else
        echo -e "${RED}System has failures - action required${NC}"
    fi
    
    output ""
}

#-------------------------------------------------------------------------------
# Main execution
#-------------------------------------------------------------------------------
main() {
    if [[ "$QUIET" != true ]]; then
        echo ""
        echo "==============================================================================="
        echo "ARI V11.0 HEALTH CHECK"
        echo "==============================================================================="
    fi
    
    check_directories
    check_core_files
    check_governance
    check_council
    check_agents
    check_schemas
    check_config
    check_memory
    check_disk_space
    check_permissions
    
    if [[ "$JSON_OUTPUT" == true ]]; then
        generate_json_report
    else
        print_summary
    fi
    
    # Return appropriate exit code
    if [[ $CHECKS_FAILED -gt 0 ]]; then
        exit 1
    elif [[ $CHECKS_WARNED -gt 0 ]]; then
        exit 2
    else
        exit 0
    fi
}

main "$@"
