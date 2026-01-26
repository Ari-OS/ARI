#!/bin/bash
#===============================================================================
# ARI V11.0 BOOTSTRAP SCRIPT
# Initialize and configure the ARI system for first-time use
#===============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="${ROOT_DIR}/logs/bootstrap_$(date +%Y%m%d_%H%M%S).log"
CONFIG_DIR="${ROOT_DIR}/CONFIG"
DATA_DIR="${ROOT_DIR}/data"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

#-------------------------------------------------------------------------------
# Logging functions
#-------------------------------------------------------------------------------
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    case "$level" in
        INFO)  echo -e "${BLUE}[INFO]${NC} $message" ;;
        OK)    echo -e "${GREEN}[OK]${NC} $message" ;;
        WARN)  echo -e "${YELLOW}[WARN]${NC} $message" ;;
        ERROR) echo -e "${RED}[ERROR]${NC} $message" ;;
    esac
}

#-------------------------------------------------------------------------------
# Pre-flight checks
#-------------------------------------------------------------------------------
preflight_checks() {
    log INFO "Running pre-flight checks..."
    
    # Check for required commands
    local required_commands=("jq" "curl" "git")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log WARN "$cmd is not installed. Some features may be limited."
        else
            log OK "$cmd found"
        fi
    done
    
    # Check directory structure
    if [[ ! -d "$ROOT_DIR/SYSTEM" ]]; then
        log ERROR "Invalid ARI directory structure. Missing SYSTEM directory."
        exit 1
    fi
    
    log OK "Pre-flight checks passed"
}

#-------------------------------------------------------------------------------
# Create directory structure
#-------------------------------------------------------------------------------
create_directories() {
    log INFO "Creating directory structure..."
    
    local directories=(
        "${ROOT_DIR}/data"
        "${ROOT_DIR}/data/memory"
        "${ROOT_DIR}/data/backups"
        "${ROOT_DIR}/data/exports"
        "${ROOT_DIR}/data/temp"
        "${ROOT_DIR}/logs"
        "${ROOT_DIR}/logs/events"
        "${ROOT_DIR}/logs/audit"
        "${ROOT_DIR}/logs/errors"
        "${ROOT_DIR}/cache"
    )
    
    for dir in "${directories[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            log OK "Created: $dir"
        else
            log INFO "Exists: $dir"
        fi
    done
    
    # Set permissions
    chmod 750 "${ROOT_DIR}/data"
    chmod 750 "${ROOT_DIR}/logs"
    
    log OK "Directory structure ready"
}

#-------------------------------------------------------------------------------
# Initialize configuration
#-------------------------------------------------------------------------------
init_config() {
    log INFO "Initializing configuration..."
    
    local active_config="${CONFIG_DIR}/active_config.json"
    
    if [[ -f "$active_config" ]]; then
        log WARN "Active configuration already exists. Skipping."
        return 0
    fi
    
    # Copy defaults to active config
    if [[ -f "${CONFIG_DIR}/defaults.json" ]]; then
        cp "${CONFIG_DIR}/defaults.json" "$active_config"
        log OK "Created active_config.json from defaults"
    else
        log ERROR "defaults.json not found!"
        exit 1
    fi
    
    # Validate configuration
    if command -v jq &> /dev/null; then
        if jq empty "$active_config" 2>/dev/null; then
            log OK "Configuration is valid JSON"
        else
            log ERROR "Configuration is invalid JSON"
            exit 1
        fi
    fi
    
    log OK "Configuration initialized"
}

#-------------------------------------------------------------------------------
# Initialize memory store
#-------------------------------------------------------------------------------
init_memory() {
    log INFO "Initializing memory store..."
    
    local memory_file="${DATA_DIR}/memory/core_memory.json"
    
    if [[ -f "$memory_file" ]]; then
        log WARN "Memory store already exists. Skipping initialization."
        return 0
    fi
    
    # Create initial memory structure
    cat > "$memory_file" << 'EOF'
{
  "schema_version": "1.0.0",
  "initialized_at": null,
  "entries": [],
  "indexes": {
    "by_type": {},
    "by_category": {},
    "by_timestamp": []
  },
  "metadata": {
    "total_entries": 0,
    "last_write": null,
    "integrity_hash": null
  }
}
EOF
    
    # Set initialization timestamp
    if command -v jq &> /dev/null; then
        local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        jq --arg ts "$timestamp" '.initialized_at = $ts' "$memory_file" > "${memory_file}.tmp"
        mv "${memory_file}.tmp" "$memory_file"
    fi
    
    chmod 640 "$memory_file"
    log OK "Memory store initialized"
}

#-------------------------------------------------------------------------------
# Generate system fingerprint
#-------------------------------------------------------------------------------
generate_fingerprint() {
    log INFO "Generating system fingerprint..."
    
    local fingerprint_file="${DATA_DIR}/system_fingerprint.json"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local hostname=$(hostname 2>/dev/null || echo "unknown")
    local user=$(whoami 2>/dev/null || echo "unknown")
    
    cat > "$fingerprint_file" << EOF
{
  "system_id": "ari-v11-$(date +%Y%m%d%H%M%S)-$(head -c 8 /dev/urandom | xxd -p)",
  "version": "11.0.0",
  "initialized_at": "$timestamp",
  "initialized_by": "$user",
  "host": "$hostname",
  "environment": "development",
  "status": "initialized"
}
EOF
    
    log OK "System fingerprint generated"
}

#-------------------------------------------------------------------------------
# Validate schemas
#-------------------------------------------------------------------------------
validate_schemas() {
    log INFO "Validating JSON schemas..."
    
    if ! command -v jq &> /dev/null; then
        log WARN "jq not available. Skipping schema validation."
        return 0
    fi
    
    local schema_dir="${ROOT_DIR}/SCHEMAS"
    local errors=0
    
    for schema in "${schema_dir}"/*.json; do
        if [[ -f "$schema" ]]; then
            if jq empty "$schema" 2>/dev/null; then
                log OK "Valid: $(basename "$schema")"
            else
                log ERROR "Invalid: $(basename "$schema")"
                ((errors++))
            fi
        fi
    done
    
    if [[ $errors -gt 0 ]]; then
        log ERROR "$errors schema(s) failed validation"
        return 1
    fi
    
    log OK "All schemas valid"
}

#-------------------------------------------------------------------------------
# Run initial health check
#-------------------------------------------------------------------------------
initial_health_check() {
    log INFO "Running initial health check..."
    
    local health_script="${SCRIPT_DIR}/health_check.sh"
    
    if [[ -x "$health_script" ]]; then
        if "$health_script" --quiet; then
            log OK "Health check passed"
        else
            log WARN "Health check reported issues"
        fi
    else
        log WARN "Health check script not available"
    fi
}

#-------------------------------------------------------------------------------
# Print summary
#-------------------------------------------------------------------------------
print_summary() {
    echo ""
    echo "==============================================================================="
    echo -e "${GREEN}ARI V11.0 BOOTSTRAP COMPLETE${NC}"
    echo "==============================================================================="
    echo ""
    echo "System initialized successfully!"
    echo ""
    echo "Next steps:"
    echo "  1. Review configuration in CONFIG/active_config.json"
    echo "  2. Customize operator profile as needed"
    echo "  3. Run health_check.sh to verify system status"
    echo "  4. Start using ARI with your preferred interface"
    echo ""
    echo "Log file: $LOG_FILE"
    echo ""
}

#-------------------------------------------------------------------------------
# Main execution
#-------------------------------------------------------------------------------
main() {
    echo ""
    echo "==============================================================================="
    echo "ARI V11.0 BOOTSTRAP"
    echo "==============================================================================="
    echo ""
    
    # Create log directory first
    mkdir -p "$(dirname "$LOG_FILE")"
    
    log INFO "Starting ARI V11.0 bootstrap..."
    log INFO "Root directory: $ROOT_DIR"
    
    preflight_checks
    create_directories
    init_config
    init_memory
    generate_fingerprint
    validate_schemas
    initial_health_check
    
    log OK "Bootstrap completed successfully"
    print_summary
}

# Run main function
main "$@"
