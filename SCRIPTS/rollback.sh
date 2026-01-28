#!/bin/bash
#===============================================================================
# ARI V11.0 ROLLBACK SCRIPT
# Rollback to a previous system state
#===============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${ROOT_DIR}/data/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${ROOT_DIR}/logs/rollback_${TIMESTAMP}.log"

# Options
DRY_RUN=false
FORCE=false
QUIET=false
TARGET=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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
        esac
    fi
}

#-------------------------------------------------------------------------------
# Parse arguments
#-------------------------------------------------------------------------------
show_help() {
    cat << EOF
Usage: $0 [OPTIONS] [TARGET]

Rollback ARI system to a previous state.

Options:
  -l, --list            List available rollback points
  -p, --pre-restore     Rollback to most recent pre-restore backup
  -c, --config          Rollback configuration only
  -d, --dry-run         Show what would be rolled back
  -f, --force           Skip confirmation prompts
  -q, --quiet           Minimal output
  -h, --help            Show this help

Target:
  Backup filename or timestamp (e.g., 20260125_143022)
  
Examples:
  $0 --list                           # List rollback points
  $0 --pre-restore                    # Rollback to last pre-restore state
  $0 20260125_143022                  # Rollback to specific timestamp
  $0 ari_backup_full_20260125.tar.gz  # Rollback to specific backup
EOF
}

LIST_MODE=false
PRE_RESTORE=false
CONFIG_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -l|--list)
            LIST_MODE=true
            shift
            ;;
        -p|--pre-restore)
            PRE_RESTORE=true
            shift
            ;;
        -c|--config)
            CONFIG_ONLY=true
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -f|--force)
            FORCE=true
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
        -*)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
        *)
            TARGET="$1"
            shift
            ;;
    esac
done

#-------------------------------------------------------------------------------
# List rollback points
#-------------------------------------------------------------------------------
list_rollback_points() {
    echo ""
    echo "Available Rollback Points"
    echo "========================="
    echo ""
    
    # List regular backups
    echo "Backups:"
    echo "--------"
    local backup_count=0
    while IFS= read -r backup; do
        if [[ -f "$backup" ]]; then
            local name=$(basename "$backup")
            local size=$(du -h "$backup" | cut -f1)
            local date=$(stat -c %y "$backup" 2>/dev/null | cut -d' ' -f1,2 | cut -d'.' -f1 || \
                        stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$backup" 2>/dev/null)
            printf "  %-50s %8s  %s\n" "$name" "$size" "$date"
            ((backup_count++))
        fi
    done < <(find "$BACKUP_DIR" -name "ari_backup_*.tar*" -type f 2>/dev/null | sort -r | head -10)
    
    if [[ $backup_count -eq 0 ]]; then
        echo "  (no backups found)"
    fi
    
    # List pre-restore backups
    echo ""
    echo "Pre-Restore States:"
    echo "-------------------"
    local prerestore_count=0
    while IFS= read -r dir; do
        if [[ -d "$dir" ]]; then
            local name=$(basename "$dir")
            local date=$(stat -c %y "$dir" 2>/dev/null | cut -d' ' -f1,2 | cut -d'.' -f1 || \
                        stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$dir" 2>/dev/null)
            printf "  %-50s %s\n" "$name" "$date"
            ((prerestore_count++))
        fi
    done < <(find "$BACKUP_DIR" -maxdepth 1 -type d -name "pre_restore_*" 2>/dev/null | sort -r | head -5)
    
    if [[ $prerestore_count -eq 0 ]]; then
        echo "  (no pre-restore states found)"
    fi
    
    # List config backups
    echo ""
    echo "Configuration Backups:"
    echo "----------------------"
    local config_dir="${ROOT_DIR}/CONFIG"
    local config_count=0
    while IFS= read -r config; do
        if [[ -f "$config" ]]; then
            local name=$(basename "$config")
            printf "  %s\n" "$name"
            ((config_count++))
        fi
    done < <(find "$config_dir" -name "*.bak" -o -name "active_config.*.json" 2>/dev/null | sort -r | head -5)
    
    if [[ $config_count -eq 0 ]]; then
        echo "  (no config backups found)"
    fi
    
    echo ""
}

#-------------------------------------------------------------------------------
# Find rollback target
#-------------------------------------------------------------------------------
find_rollback_target() {
    local search="$1"
    
    # Check for pre-restore directory
    if [[ "$PRE_RESTORE" == true ]]; then
        local latest_prerestore=$(find "$BACKUP_DIR" -maxdepth 1 -type d -name "pre_restore_*" 2>/dev/null | sort -r | head -1)
        if [[ -n "$latest_prerestore" ]]; then
            echo "$latest_prerestore"
            return 0
        else
            log ERROR "No pre-restore backup found"
            return 1
        fi
    fi
    
    # Check if it's a direct path
    if [[ -f "$search" ]]; then
        echo "$search"
        return 0
    fi
    
    # Check in backup directory
    if [[ -f "${BACKUP_DIR}/${search}" ]]; then
        echo "${BACKUP_DIR}/${search}"
        return 0
    fi
    
    # Search by timestamp pattern
    local found=$(find "$BACKUP_DIR" -name "*${search}*" -type f 2>/dev/null | head -1)
    if [[ -n "$found" ]]; then
        echo "$found"
        return 0
    fi
    
    # Search pre-restore directories
    found=$(find "$BACKUP_DIR" -maxdepth 1 -type d -name "*${search}*" 2>/dev/null | head -1)
    if [[ -n "$found" ]]; then
        echo "$found"
        return 0
    fi
    
    log ERROR "Could not find rollback target: $search"
    return 1
}

#-------------------------------------------------------------------------------
# Rollback from pre-restore directory
#-------------------------------------------------------------------------------
rollback_from_directory() {
    local source_dir="$1"
    
    log INFO "Rolling back from: $source_dir"
    
    if [[ "$DRY_RUN" == true ]]; then
        log INFO "DRY RUN - Would restore from directory:"
        find "$source_dir" -type f | head -20
        return 0
    fi
    
    # Restore config if present
    if [[ -d "${source_dir}/CONFIG" ]]; then
        log INFO "Restoring configuration..."
        cp -r "${source_dir}/CONFIG/"* "${ROOT_DIR}/CONFIG/" 2>/dev/null || true
        log OK "Configuration restored"
    fi
    
    # Restore memory if present
    if [[ -d "${source_dir}/memory" ]]; then
        log INFO "Restoring memory store..."
        cp -r "${source_dir}/memory/"* "${ROOT_DIR}/data/memory/" 2>/dev/null || true
        log OK "Memory restored"
    fi
}

#-------------------------------------------------------------------------------
# Rollback from backup file
#-------------------------------------------------------------------------------
rollback_from_backup() {
    local backup_file="$1"
    
    log INFO "Rolling back from: $(basename "$backup_file")"
    
    # Use restore script
    local restore_script="${SCRIPT_DIR}/restore.sh"
    
    if [[ ! -x "$restore_script" ]]; then
        log ERROR "Restore script not found or not executable"
        return 1
    fi
    
    local restore_args=""
    if [[ "$DRY_RUN" == true ]]; then
        restore_args="--dry-run"
    fi
    if [[ "$FORCE" == true ]]; then
        restore_args="$restore_args --force"
    fi
    if [[ "$QUIET" == true ]]; then
        restore_args="$restore_args --quiet"
    fi
    
    "$restore_script" $restore_args "$backup_file"
}

#-------------------------------------------------------------------------------
# Rollback configuration only
#-------------------------------------------------------------------------------
rollback_config() {
    log INFO "Rolling back configuration only..."
    
    local config_dir="${ROOT_DIR}/CONFIG"
    local active_config="${config_dir}/active_config.json"
    local backup_config="${active_config}.bak"
    
    if [[ -f "$backup_config" ]]; then
        if [[ "$DRY_RUN" == true ]]; then
            log INFO "Would restore active_config.json from backup"
        else
            cp "$backup_config" "$active_config"
            log OK "Configuration rolled back"
        fi
    else
        log ERROR "No configuration backup found"
        return 1
    fi
}

#-------------------------------------------------------------------------------
# Post-rollback verification
#-------------------------------------------------------------------------------
post_rollback_verify() {
    log INFO "Verifying rollback..."
    
    local health_script="${SCRIPT_DIR}/health_check.sh"
    if [[ -x "$health_script" ]]; then
        if "$health_script" --quiet; then
            log OK "System health verified"
        else
            log WARN "Health check reported issues after rollback"
        fi
    fi
}

#-------------------------------------------------------------------------------
# Create rollback record
#-------------------------------------------------------------------------------
create_rollback_record() {
    local target="$1"
    local record_file="${ROOT_DIR}/data/.rollback_history"
    
    mkdir -p "$(dirname "$record_file")"
    
    echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") | $target | $(whoami)" >> "$record_file"
    
    log OK "Rollback recorded"
}

#-------------------------------------------------------------------------------
# Main execution
#-------------------------------------------------------------------------------
main() {
    if [[ "$QUIET" != true ]]; then
        echo ""
        echo "==============================================================================="
        echo "ARI V11.0 ROLLBACK"
        echo "==============================================================================="
        echo ""
    fi
    
    # Handle list mode
    if [[ "$LIST_MODE" == true ]]; then
        list_rollback_points
        exit 0
    fi
    
    # Config-only rollback
    if [[ "$CONFIG_ONLY" == true ]]; then
        if [[ "$FORCE" != true && "$DRY_RUN" != true ]]; then
            echo -e "${YELLOW}WARNING: This will rollback configuration to last backup.${NC}"
            read -p "Continue? [y/N] " -n 1 -r
            echo ""
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 0
            fi
        fi
        rollback_config
        exit 0
    fi
    
    # Need a target
    if [[ -z "$TARGET" && "$PRE_RESTORE" != true ]]; then
        log ERROR "No rollback target specified"
        echo ""
        show_help
        exit 1
    fi
    
    # Find the target
    local rollback_source
    rollback_source=$(find_rollback_target "$TARGET")
    
    log INFO "Rollback source: $rollback_source"
    
    # Confirm
    if [[ "$FORCE" != true && "$DRY_RUN" != true ]]; then
        echo ""
        echo -e "${YELLOW}WARNING: This will rollback the system to a previous state!${NC}"
        echo ""
        read -p "Continue with rollback? [y/N] " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log INFO "Rollback cancelled"
            exit 0
        fi
    fi
    
    # Perform rollback
    if [[ -d "$rollback_source" ]]; then
        rollback_from_directory "$rollback_source"
    elif [[ -f "$rollback_source" ]]; then
        rollback_from_backup "$rollback_source"
    else
        log ERROR "Invalid rollback source"
        exit 1
    fi
    
    # Post-rollback
    if [[ "$DRY_RUN" != true ]]; then
        create_rollback_record "$rollback_source"
        post_rollback_verify
        
        echo ""
        echo "==============================================================================="
        echo -e "${GREEN}ROLLBACK COMPLETE${NC}"
        echo "==============================================================================="
        echo ""
        echo "  Source: $(basename "$rollback_source")"
        echo "  Log: $LOG_FILE"
        echo ""
        echo "  Run health_check.sh to verify system status"
        echo ""
    else
        echo ""
        echo -e "${YELLOW}DRY RUN COMPLETE - No changes made${NC}"
        echo ""
    fi
}

main "$@"
