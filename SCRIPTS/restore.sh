#!/bin/bash
#===============================================================================
# ARI V11.0 RESTORE SCRIPT
# Restore system from backup
#===============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${ROOT_DIR}/data/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${ROOT_DIR}/logs/restore_${TIMESTAMP}.log"

# Options
DRY_RUN=false
FORCE=false
VERIFY_ONLY=false
QUIET=false

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
Usage: $0 [OPTIONS] [BACKUP_FILE]

Restore ARI system from a backup file.

Options:
  -l, --list           List available backups
  -L, --latest         Restore from latest backup
  -d, --dry-run        Show what would be restored without doing it
  -f, --force          Skip confirmation prompts
  -v, --verify         Verify backup only, don't restore
  -q, --quiet          Minimal output
  -h, --help           Show this help

Arguments:
  BACKUP_FILE          Path to backup file (optional if using --latest)

Examples:
  $0 --list                           # List available backups
  $0 --latest                         # Restore from most recent backup
  $0 data/backups/ari_backup_full_20260125.tar.gz
  $0 --dry-run --latest               # Preview restore
EOF
}

BACKUP_FILE=""
LIST_MODE=false
LATEST_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -l|--list)
            LIST_MODE=true
            shift
            ;;
        -L|--latest)
            LATEST_MODE=true
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
        -v|--verify)
            VERIFY_ONLY=true
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
            BACKUP_FILE="$1"
            shift
            ;;
    esac
done

#-------------------------------------------------------------------------------
# List available backups
#-------------------------------------------------------------------------------
list_backups() {
    echo ""
    echo "Available Backups:"
    echo "=================="
    echo ""
    
    if [[ ! -d "$BACKUP_DIR" ]]; then
        echo "No backup directory found."
        exit 0
    fi
    
    local count=0
    while IFS= read -r backup; do
        if [[ -f "$backup" ]]; then
            local name=$(basename "$backup")
            local size=$(du -h "$backup" | cut -f1)
            local date=$(stat -c %y "$backup" 2>/dev/null | cut -d' ' -f1 || stat -f %Sm -t %Y-%m-%d "$backup" 2>/dev/null)
            
            # Check for metadata
            local type="unknown"
            if [[ -f "${backup}.meta.json" ]] && command -v jq &> /dev/null; then
                type=$(jq -r '.backup_type // "unknown"' "${backup}.meta.json" 2>/dev/null)
            elif [[ "$name" == *"_full_"* ]]; then
                type="full"
            elif [[ "$name" == *"_incremental_"* ]]; then
                type="incremental"
            elif [[ "$name" == *"_config_"* ]]; then
                type="config"
            fi
            
            printf "  %-50s %8s  %-12s  %s\n" "$name" "$size" "$type" "$date"
            ((count++))
        fi
    done < <(find "$BACKUP_DIR" -name "ari_backup_*.tar*" -type f | sort -r)
    
    echo ""
    echo "Total: $count backup(s)"
    echo ""
}

#-------------------------------------------------------------------------------
# Get latest backup
#-------------------------------------------------------------------------------
get_latest_backup() {
    local latest=$(find "$BACKUP_DIR" -name "ari_backup_*.tar*" -type f 2>/dev/null | sort -r | head -1)
    
    if [[ -z "$latest" ]]; then
        log ERROR "No backups found in $BACKUP_DIR"
        exit 1
    fi
    
    echo "$latest"
}

#-------------------------------------------------------------------------------
# Verify backup integrity
#-------------------------------------------------------------------------------
verify_backup() {
    local backup_file="$1"
    
    log INFO "Verifying backup: $(basename "$backup_file")"
    
    # Check file exists
    if [[ ! -f "$backup_file" ]]; then
        log ERROR "Backup file not found: $backup_file"
        return 1
    fi
    
    # Check checksum if available
    local checksum_file="${backup_file}.sha256"
    if [[ -f "$checksum_file" ]]; then
        log INFO "Verifying checksum..."
        if sha256sum -c "$checksum_file" &>/dev/null || shasum -a 256 -c "$checksum_file" &>/dev/null; then
            log OK "Checksum verified"
        else
            log ERROR "Checksum verification failed!"
            return 1
        fi
    else
        log WARN "No checksum file found, skipping checksum verification"
    fi
    
    # Verify archive integrity based on type
    if [[ "$backup_file" == *.gpg ]]; then
        log INFO "Encrypted backup detected"
        if [[ -f "$backup_file" && -s "$backup_file" ]]; then
            log OK "Encrypted file exists and is non-empty"
        else
            log ERROR "Encrypted file is missing or empty"
            return 1
        fi
    elif [[ "$backup_file" == *.gz ]]; then
        log INFO "Testing gzip integrity..."
        if gzip -t "$backup_file" 2>/dev/null; then
            log OK "Gzip integrity OK"
        else
            log ERROR "Gzip integrity check failed!"
            return 1
        fi
    elif [[ "$backup_file" == *.tar ]]; then
        log INFO "Testing tar integrity..."
        if tar -tf "$backup_file" &>/dev/null; then
            log OK "Tar integrity OK"
        else
            log ERROR "Tar integrity check failed!"
            return 1
        fi
    fi
    
    # Show metadata if available
    local meta_file="${backup_file}.meta.json"
    if [[ -f "$meta_file" ]] && command -v jq &> /dev/null; then
        echo ""
        log INFO "Backup metadata:"
        jq -r '
            "  Type: \(.backup_type)",
            "  Created: \(.timestamp)",
            "  Size: \(.size_bytes) bytes",
            "  Compressed: \(.compressed)",
            "  Encrypted: \(.encrypted)"
        ' "$meta_file" 2>/dev/null
    fi
    
    return 0
}

#-------------------------------------------------------------------------------
# Create pre-restore backup
#-------------------------------------------------------------------------------
create_pre_restore_backup() {
    log INFO "Creating pre-restore safety backup..."
    
    local safety_dir="${BACKUP_DIR}/pre_restore_${TIMESTAMP}"
    mkdir -p "$safety_dir"
    
    # Backup critical directories
    local critical=("CONFIG" "data/memory")
    for dir in "${critical[@]}"; do
        if [[ -d "${ROOT_DIR}/${dir}" ]]; then
            cp -r "${ROOT_DIR}/${dir}" "$safety_dir/" 2>/dev/null || true
        fi
    done
    
    log OK "Safety backup created: $safety_dir"
    echo "$safety_dir"
}

#-------------------------------------------------------------------------------
# Prepare backup file (decrypt/decompress)
#-------------------------------------------------------------------------------
prepare_backup() {
    local backup_file="$1"
    local work_file="$backup_file"
    
    # Handle encrypted backups
    if [[ "$backup_file" == *.gpg ]]; then
        if ! command -v gpg &> /dev/null; then
            log ERROR "gpg required to decrypt backup"
            exit 1
        fi
        
        log INFO "Decrypting backup..."
        local decrypted="${backup_file%.gpg}"
        gpg --decrypt -o "$decrypted" "$backup_file"
        work_file="$decrypted"
        log OK "Decrypted to: $work_file"
    fi
    
    # Handle compressed backups
    if [[ "$work_file" == *.gz ]]; then
        log INFO "Decompressing backup..."
        local decompressed="${work_file%.gz}"
        gunzip -c "$work_file" > "$decompressed"
        
        # Clean up decrypted intermediate if we created it
        if [[ "$work_file" != "$backup_file" ]]; then
            rm -f "$work_file"
        fi
        
        work_file="$decompressed"
        log OK "Decompressed to: $work_file"
    fi
    
    echo "$work_file"
}

#-------------------------------------------------------------------------------
# Perform restore
#-------------------------------------------------------------------------------
perform_restore() {
    local tar_file="$1"
    local original_file="$2"
    
    log INFO "Restoring from: $(basename "$original_file")"
    
    if [[ "$DRY_RUN" == true ]]; then
        log INFO "DRY RUN - Would restore the following files:"
        tar -tvf "$tar_file" | head -50
        local total=$(tar -tf "$tar_file" | wc -l)
        echo "... and $((total - 50)) more files" 2>/dev/null || true
        return 0
    fi
    
    # Confirm restore
    if [[ "$FORCE" != true ]]; then
        echo ""
        echo -e "${YELLOW}WARNING: This will overwrite existing files!${NC}"
        echo ""
        read -p "Continue with restore? [y/N] " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log INFO "Restore cancelled by user"
            exit 0
        fi
    fi
    
    # Create safety backup
    local safety_backup
    safety_backup=$(create_pre_restore_backup)
    
    # Extract files
    log INFO "Extracting files..."
    tar -xf "$tar_file" -C "$ROOT_DIR" 2>/dev/null || \
        tar -xf "$tar_file" -C "$ROOT_DIR" --strip-components=1 2>/dev/null
    
    local file_count=$(tar -tf "$tar_file" | wc -l)
    log OK "Restored $file_count files"
    
    # Cleanup temp files
    if [[ "$tar_file" != "$original_file" ]]; then
        rm -f "$tar_file"
    fi
    
    echo "$safety_backup"
}

#-------------------------------------------------------------------------------
# Post-restore verification
#-------------------------------------------------------------------------------
post_restore_verify() {
    log INFO "Running post-restore verification..."
    
    # Run health check if available
    local health_script="${SCRIPT_DIR}/health_check.sh"
    if [[ -x "$health_script" ]]; then
        if "$health_script" --quiet; then
            log OK "Health check passed"
        else
            log WARN "Health check reported issues - review recommended"
        fi
    fi
    
    # Verify critical files exist
    local critical_files=(
        "SYSTEM/CORE_IDENTITY.md"
        "SYSTEM/CONSTITUTION.md"
    )
    
    local missing=0
    for file in "${critical_files[@]}"; do
        if [[ ! -f "${ROOT_DIR}/${file}" ]]; then
            log WARN "Critical file missing after restore: $file"
            ((missing++))
        fi
    done
    
    if [[ $missing -eq 0 ]]; then
        log OK "All critical files present"
    fi
}

#-------------------------------------------------------------------------------
# Main execution
#-------------------------------------------------------------------------------
main() {
    if [[ "$QUIET" != true ]]; then
        echo ""
        echo "==============================================================================="
        echo "ARI V11.0 RESTORE"
        echo "==============================================================================="
        echo ""
    fi
    
    # Handle list mode
    if [[ "$LIST_MODE" == true ]]; then
        list_backups
        exit 0
    fi
    
    # Determine backup file
    if [[ "$LATEST_MODE" == true ]]; then
        BACKUP_FILE=$(get_latest_backup)
        log INFO "Using latest backup: $(basename "$BACKUP_FILE")"
    elif [[ -z "$BACKUP_FILE" ]]; then
        log ERROR "No backup file specified. Use --latest or provide a path."
        echo ""
        show_help
        exit 1
    fi
    
    # Resolve relative paths
    if [[ ! "$BACKUP_FILE" = /* ]]; then
        if [[ -f "${BACKUP_DIR}/${BACKUP_FILE}" ]]; then
            BACKUP_FILE="${BACKUP_DIR}/${BACKUP_FILE}"
        elif [[ ! -f "$BACKUP_FILE" ]]; then
            log ERROR "Backup file not found: $BACKUP_FILE"
            exit 1
        fi
    fi
    
    # Verify backup
    if ! verify_backup "$BACKUP_FILE"; then
        log ERROR "Backup verification failed"
        exit 1
    fi
    
    # Verify only mode
    if [[ "$VERIFY_ONLY" == true ]]; then
        echo ""
        log OK "Backup verification complete"
        exit 0
    fi
    
    # Prepare and restore
    local prepared_file
    prepared_file=$(prepare_backup "$BACKUP_FILE")
    
    local safety_backup
    safety_backup=$(perform_restore "$prepared_file" "$BACKUP_FILE")
    
    # Post-restore verification
    if [[ "$DRY_RUN" != true ]]; then
        post_restore_verify
        
        echo ""
        echo "==============================================================================="
        echo -e "${GREEN}RESTORE COMPLETE${NC}"
        echo "==============================================================================="
        echo ""
        echo "  Source: $(basename "$BACKUP_FILE")"
        echo "  Safety backup: $safety_backup"
        echo ""
        echo "  Run health_check.sh to verify system status"
        echo ""
    fi
}

main "$@"
