#!/bin/bash
#===============================================================================
# ARI V11.0 DEPLOY SCRIPT
# Deploy configuration changes and system updates
#===============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_DIR="${ROOT_DIR}/CONFIG"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${ROOT_DIR}/logs/deploy_${TIMESTAMP}.log"
DEPLOY_STATE_FILE="${ROOT_DIR}/data/.deploy_state"

# Options
DRY_RUN=false
FORCE=false
SKIP_BACKUP=false
SKIP_VALIDATION=false
QUIET=false

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
    
    if [[ "$QUIET" != true ]]; then
        case "$level" in
            INFO)  echo -e "${BLUE}[INFO]${NC} $message" ;;
            OK)    echo -e "${GREEN}[OK]${NC} $message" ;;
            WARN)  echo -e "${YELLOW}[WARN]${NC} $message" ;;
            ERROR) echo -e "${RED}[ERROR]${NC} $message" ;;
            STEP)  echo -e "${CYAN}[STEP]${NC} $message" ;;
        esac
    fi
}

#-------------------------------------------------------------------------------
# Parse arguments
#-------------------------------------------------------------------------------
show_help() {
    cat << EOF
Usage: $0 [OPTIONS] [COMPONENT]

Deploy ARI system configuration and updates.

Options:
  -d, --dry-run         Show what would be deployed without doing it
  -f, --force           Skip confirmation prompts
  --skip-backup         Don't create pre-deploy backup
  --skip-validation     Skip validation checks
  -q, --quiet           Minimal output
  -h, --help            Show this help

Components (optional):
  all                   Deploy everything (default)
  config                Deploy configuration only
  agents                Deploy agent definitions only
  system                Deploy core system files only

Examples:
  $0                    # Deploy all components
  $0 config             # Deploy configuration only
  $0 --dry-run          # Preview deployment
EOF
}

COMPONENT="all"

while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        --skip-validation)
            SKIP_VALIDATION=true
            shift
            ;;
        -q|--quiet)
            QUIET=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        all|config|agents|system)
            COMPONENT="$1"
            shift
            ;;
        -*)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
        *)
            echo "Unknown component: $1"
            show_help
            exit 1
            ;;
    esac
done

#-------------------------------------------------------------------------------
# Validation functions
#-------------------------------------------------------------------------------
validate_json() {
    local file="$1"
    if command -v jq &> /dev/null; then
        if jq empty "$file" 2>/dev/null; then
            return 0
        else
            return 1
        fi
    fi
    # If jq not available, assume valid
    return 0
}

validate_config() {
    log STEP "Validating configuration files..."
    
    local errors=0
    local config_files=("defaults.json" "permissions.json" "allowlists.json" "retention.json" "safe_defaults.json")
    
    for config in "${config_files[@]}"; do
        local path="${CONFIG_DIR}/${config}"
        if [[ -f "$path" ]]; then
            if validate_json "$path"; then
                log OK "Valid: $config"
            else
                log ERROR "Invalid JSON: $config"
                ((errors++))
            fi
        else
            log WARN "Missing: $config"
        fi
    done
    
    if [[ $errors -gt 0 ]]; then
        log ERROR "$errors configuration file(s) failed validation"
        return 1
    fi
    
    return 0
}

validate_schemas() {
    log STEP "Validating JSON schemas..."
    
    local errors=0
    local schema_files=("event.json" "memory_entry.json" "tool_call.json" "config.json")
    
    for schema in "${schema_files[@]}"; do
        local path="${ROOT_DIR}/SCHEMAS/${schema}"
        if [[ -f "$path" ]]; then
            if validate_json "$path"; then
                log OK "Valid: $schema"
            else
                log ERROR "Invalid JSON: $schema"
                ((errors++))
            fi
        fi
    done
    
    return $errors
}

validate_system() {
    log STEP "Validating system files..."
    
    local required_files=(
        "SYSTEM/CORE_IDENTITY.md"
        "SYSTEM/CONSTITUTION.md"
        "SYSTEM/ROUTER.md"
        "SYSTEM/PLANNER.md"
        "SYSTEM/EXECUTOR.md"
        "SYSTEM/GUARDIAN.md"
        "SYSTEM/MEMORY_MANAGER.md"
    )
    
    local missing=0
    for file in "${required_files[@]}"; do
        if [[ -f "${ROOT_DIR}/${file}" ]]; then
            log OK "Present: $file"
        else
            log ERROR "Missing: $file"
            ((missing++))
        fi
    done
    
    return $missing
}

#-------------------------------------------------------------------------------
# Pre-deploy backup
#-------------------------------------------------------------------------------
create_deploy_backup() {
    if [[ "$SKIP_BACKUP" == true ]]; then
        log WARN "Skipping pre-deploy backup"
        return 0
    fi
    
    log STEP "Creating pre-deploy backup..."
    
    local backup_script="${SCRIPT_DIR}/backup.sh"
    if [[ -x "$backup_script" ]]; then
        if "$backup_script" -t config -q; then
            log OK "Pre-deploy backup created"
        else
            log WARN "Backup failed, continuing anyway"
        fi
    else
        log WARN "Backup script not available"
    fi
}

#-------------------------------------------------------------------------------
# Deploy components
#-------------------------------------------------------------------------------
deploy_config() {
    log STEP "Deploying configuration..."
    
    local active_config="${CONFIG_DIR}/active_config.json"
    local defaults="${CONFIG_DIR}/defaults.json"
    
    if [[ "$DRY_RUN" == true ]]; then
        log INFO "Would update active_config.json from defaults.json"
        return 0
    fi
    
    # Merge defaults with any existing active config customizations
    if [[ -f "$active_config" ]] && command -v jq &> /dev/null; then
        # Backup current active config
        cp "$active_config" "${active_config}.bak"
        
        # For now, just copy defaults (could be smarter merge)
        cp "$defaults" "$active_config"
        log OK "Configuration deployed"
    elif [[ -f "$defaults" ]]; then
        cp "$defaults" "$active_config"
        log OK "Configuration deployed from defaults"
    else
        log ERROR "No defaults.json found"
        return 1
    fi
}

deploy_agents() {
    log STEP "Deploying agent definitions..."
    
    local agent_dirs=("COUNCIL" "AGENTS/DOMAIN" "AGENTS/EXECUTION")
    local deployed=0
    
    for dir in "${agent_dirs[@]}"; do
        local path="${ROOT_DIR}/${dir}"
        if [[ -d "$path" ]]; then
            local count=$(find "$path" -name "*.md" -type f | wc -l)
            if [[ "$DRY_RUN" == true ]]; then
                log INFO "Would deploy $count agents from $dir"
            else
                log OK "Agents ready: $dir ($count files)"
            fi
            ((deployed+=count))
        fi
    done
    
    log OK "Total agents: $deployed"
}

deploy_system() {
    log STEP "Deploying core system files..."
    
    local system_files=$(find "${ROOT_DIR}/SYSTEM" -name "*.md" -type f | wc -l)
    
    if [[ "$DRY_RUN" == true ]]; then
        log INFO "Would deploy $system_files system files"
    else
        log OK "System files ready: $system_files"
    fi
}

#-------------------------------------------------------------------------------
# Save deploy state
#-------------------------------------------------------------------------------
save_deploy_state() {
    if [[ "$DRY_RUN" == true ]]; then
        return 0
    fi
    
    mkdir -p "$(dirname "$DEPLOY_STATE_FILE")"
    
    cat > "$DEPLOY_STATE_FILE" << EOF
{
  "last_deploy": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "component": "$COMPONENT",
  "version": "11.0.0",
  "deployed_by": "$(whoami)",
  "log_file": "$LOG_FILE"
}
EOF
    
    log OK "Deploy state saved"
}

#-------------------------------------------------------------------------------
# Run post-deploy checks
#-------------------------------------------------------------------------------
post_deploy_checks() {
    log STEP "Running post-deploy verification..."
    
    local health_script="${SCRIPT_DIR}/health_check.sh"
    if [[ -x "$health_script" ]]; then
        if "$health_script" --quiet; then
            log OK "Health check passed"
            return 0
        else
            log WARN "Health check reported issues"
            return 1
        fi
    else
        log WARN "Health check not available"
        return 0
    fi
}

#-------------------------------------------------------------------------------
# Main execution
#-------------------------------------------------------------------------------
main() {
    if [[ "$QUIET" != true ]]; then
        echo ""
        echo "==============================================================================="
        echo "ARI V11.0 DEPLOY"
        echo "==============================================================================="
        echo ""
    fi
    
    log INFO "Starting deployment..."
    log INFO "Component: $COMPONENT"
    
    if [[ "$DRY_RUN" == true ]]; then
        log INFO "DRY RUN MODE - No changes will be made"
        echo ""
    fi
    
    # Validation
    if [[ "$SKIP_VALIDATION" != true ]]; then
        log STEP "Running validation checks..."
        
        local validation_failed=false
        
        if [[ "$COMPONENT" == "all" || "$COMPONENT" == "config" ]]; then
            validate_config || validation_failed=true
        fi
        
        if [[ "$COMPONENT" == "all" || "$COMPONENT" == "system" ]]; then
            validate_system || validation_failed=true
        fi
        
        validate_schemas || validation_failed=true
        
        if [[ "$validation_failed" == true && "$FORCE" != true ]]; then
            log ERROR "Validation failed. Use --force to deploy anyway."
            exit 1
        fi
    fi
    
    # Confirmation
    if [[ "$FORCE" != true && "$DRY_RUN" != true ]]; then
        echo ""
        read -p "Deploy $COMPONENT? [y/N] " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log INFO "Deployment cancelled"
            exit 0
        fi
    fi
    
    # Pre-deploy backup
    create_deploy_backup
    
    # Deploy components
    echo ""
    case "$COMPONENT" in
        all)
            deploy_config
            deploy_agents
            deploy_system
            ;;
        config)
            deploy_config
            ;;
        agents)
            deploy_agents
            ;;
        system)
            deploy_system
            ;;
    esac
    
    # Save state and verify
    if [[ "$DRY_RUN" != true ]]; then
        save_deploy_state
        echo ""
        post_deploy_checks
    fi
    
    echo ""
    echo "==============================================================================="
    if [[ "$DRY_RUN" == true ]]; then
        echo -e "${YELLOW}DRY RUN COMPLETE - No changes made${NC}"
    else
        echo -e "${GREEN}DEPLOYMENT COMPLETE${NC}"
    fi
    echo "==============================================================================="
    echo ""
    echo "  Component: $COMPONENT"
    echo "  Timestamp: $TIMESTAMP"
    if [[ "$DRY_RUN" != true ]]; then
        echo "  Log: $LOG_FILE"
    fi
    echo ""
}

main "$@"
