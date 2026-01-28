#!/bin/bash
#===============================================================================
# ARI V11.0 BACKUP SCRIPT
# Create and manage system backups
#===============================================================================

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${ROOT_DIR}/data/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${ROOT_DIR}/logs/backup_${TIMESTAMP}.log"

# Default options
BACKUP_TYPE="incremental"
COMPRESS=true
ENCRYPT=false
VERIFY=true
RETENTION_DAYS=30
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
Usage: $0 [OPTIONS]

Create a backup of the ARI system.

Options:
  -t, --type TYPE      Backup type: full, incremental, config (default: incremental)
  -o, --output DIR     Output directory (default: data/backups)
  -n, --no-compress    Don't compress the backup
  -e, --encrypt        Encrypt the backup (requires gpg)
  -k, --keep DAYS      Retention period in days (default: 30)
  -q, --quiet          Minimal output
  -h, --help           Show this help

Examples:
  $0                    # Incremental backup with defaults
  $0 -t full            # Full system backup
  $0 -t config          # Configuration only backup
  $0 -t full -e         # Full encrypted backup
EOF
}

while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            BACKUP_TYPE="$2"
            shift 2
            ;;
        -o|--output)
            BACKUP_DIR="$2"
            shift 2
            ;;
        -n|--no-compress)
            COMPRESS=false
            shift
            ;;
        -e|--encrypt)
            ENCRYPT=true
            shift
            ;;
        -k|--keep)
            RETENTION_DAYS="$2"
            shift 2
            ;;
        -q|--quiet)
            QUIET=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

#-------------------------------------------------------------------------------
# Validate backup type
#-------------------------------------------------------------------------------
validate_type() {
    case "$BACKUP_TYPE" in
        full|incremental|config)
            log INFO "Backup type: $BACKUP_TYPE"
            ;;
        *)
            log ERROR "Invalid backup type: $BACKUP_TYPE"
            exit 1
            ;;
    esac
}

#-------------------------------------------------------------------------------
# Create backup directory
#-------------------------------------------------------------------------------
setup_backup_dir() {
    if [[ ! -d "$BACKUP_DIR" ]]; then
        mkdir -p "$BACKUP_DIR"
        log OK "Created backup directory: $BACKUP_DIR"
    fi
    
    # Create logs directory if needed
    mkdir -p "$(dirname "$LOG_FILE")"
}

#-------------------------------------------------------------------------------
# Get files to backup based on type
#-------------------------------------------------------------------------------
get_backup_files() {
    local manifest_file="${BACKUP_DIR}/.backup_manifest_${TIMESTAMP}"
    
    case "$BACKUP_TYPE" in
        full)
            # Everything except backups and temp
            find "$ROOT_DIR" -type f \
                ! -path "*/data/backups/*" \
                ! -path "*/data/temp/*" \
                ! -path "*/.git/*" \
                ! -name "*.log" \
                > "$manifest_file"
            ;;
        incremental)
            # Find last backup timestamp
            local last_backup=$(ls -t "${BACKUP_DIR}"/ari_backup_*.tar* 2>/dev/null | head -1)
            if [[ -n "$last_backup" && -f "$last_backup" ]]; then
                local last_time=$(stat -c %Y "$last_backup" 2>/dev/null || stat -f %m "$last_backup" 2>/dev/null)
                find "$ROOT_DIR" -type f -newer "$last_backup" \
                    ! -path "*/data/backups/*" \
                    ! -path "*/data/temp/*" \
                    ! -path "*/.git/*" \
                    ! -name "*.log" \
                    > "$manifest_file"
            else
                # No previous backup, do full
                log WARN "No previous backup found, performing full backup"
                BACKUP_TYPE="full"
                get_backup_files
                return
            fi
            ;;
        config)
            # Only configuration and system files
            find "$ROOT_DIR" -type f \( \
                -path "*/CONFIG/*" -o \
                -path "*/SYSTEM/*" -o \
                -path "*/COUNCIL/*" -o \
                -path "*/AGENTS/*" -o \
                -path "*/SCHEMAS/*" \
            \) > "$manifest_file"
            ;;
    esac
    
    echo "$manifest_file"
}

#-------------------------------------------------------------------------------
# Create backup archive
#-------------------------------------------------------------------------------
create_backup() {
    local manifest_file="$1"
    local backup_name="ari_backup_${BACKUP_TYPE}_${TIMESTAMP}"
    local backup_file="${BACKUP_DIR}/${backup_name}.tar"
    
    local file_count=$(wc -l < "$manifest_file" 2>/dev/null || echo "0")
    log INFO "Backing up $file_count files..."
    
    if [[ $file_count -eq 0 ]]; then
        log WARN "No files to backup"
        rm -f "$manifest_file"
        return 1
    fi
    
    # Create tar archive
    tar -cf "$backup_file" -T "$manifest_file" 2>/dev/null || {
        # Fallback for systems where -T doesn't work well
        tar -cf "$backup_file" -C "$ROOT_DIR" \
            --exclude='data/backups' \
            --exclude='data/temp' \
            --exclude='.git' \
            --exclude='*.log' \
            . 2>/dev/null
    }
    
    log OK "Created archive: $backup_file"
    
    # Compress if requested
    if [[ "$COMPRESS" == true ]]; then
        log INFO "Compressing backup..."
        gzip -f "$backup_file"
        backup_file="${backup_file}.gz"
        log OK "Compressed: $backup_file"
    fi
    
    # Encrypt if requested
    if [[ "$ENCRYPT" == true ]]; then
        if command -v gpg &> /dev/null; then
            log INFO "Encrypting backup..."
            gpg --symmetric --cipher-algo AES256 "$backup_file"
            rm -f "$backup_file"
            backup_file="${backup_file}.gpg"
            log OK "Encrypted: $backup_file"
        else
            log WARN "gpg not available, skipping encryption"
        fi
    fi
    
    # Cleanup manifest
    rm -f "$manifest_file"
    
    # Report size
    local size=$(du -h "$backup_file" | cut -f1)
    log OK "Backup complete: $backup_file ($size)"
    
    echo "$backup_file"
}

#-------------------------------------------------------------------------------
# Verify backup
#-------------------------------------------------------------------------------
verify_backup() {
    local backup_file="$1"
    
    if [[ "$VERIFY" != true ]]; then
        return 0
    fi
    
    log INFO "Verifying backup integrity..."
    
    # Determine file type and verify
    if [[ "$backup_file" == *.gpg ]]; then
        log INFO "Encrypted backup - skipping content verification"
        if [[ -f "$backup_file" && -s "$backup_file" ]]; then
            log OK "Encrypted file exists and is non-empty"
            return 0
        fi
    elif [[ "$backup_file" == *.gz ]]; then
        if gzip -t "$backup_file" 2>/dev/null; then
            log OK "Gzip integrity verified"
        else
            log ERROR "Gzip verification failed!"
            return 1
        fi
    elif [[ "$backup_file" == *.tar ]]; then
        if tar -tf "$backup_file" &>/dev/null; then
            log OK "Tar integrity verified"
        else
            log ERROR "Tar verification failed!"
            return 1
        fi
    fi
    
    # Generate checksum
    local checksum_file="${backup_file}.sha256"
    sha256sum "$backup_file" > "$checksum_file" 2>/dev/null || \
        shasum -a 256 "$backup_file" > "$checksum_file" 2>/dev/null || \
        log WARN "Could not generate checksum"
    
    if [[ -f "$checksum_file" ]]; then
        log OK "Checksum saved: $checksum_file"
    fi
    
    return 0
}

#-------------------------------------------------------------------------------
# Cleanup old backups
#-------------------------------------------------------------------------------
cleanup_old_backups() {
    log INFO "Cleaning up backups older than $RETENTION_DAYS days..."
    
    local deleted=0
    while IFS= read -r -d '' file; do
        rm -f "$file"
        rm -f "${file}.sha256"
        ((deleted++))
        log INFO "Deleted: $(basename "$file")"
    done < <(find "$BACKUP_DIR" -name "ari_backup_*" -type f -mtime +$RETENTION_DAYS -print0 2>/dev/null)
    
    if [[ $deleted -gt 0 ]]; then
        log OK "Removed $deleted old backup(s)"
    else
        log INFO "No old backups to remove"
    fi
}

#-------------------------------------------------------------------------------
# Create backup metadata
#-------------------------------------------------------------------------------
create_metadata() {
    local backup_file="$1"
    local metadata_file="${backup_file}.meta.json"
    
    local size=$(du -b "$backup_file" 2>/dev/null | cut -f1 || stat -f %z "$backup_file" 2>/dev/null || echo "unknown")
    
    cat > "$metadata_file" << EOF
{
  "backup_type": "$BACKUP_TYPE",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "filename": "$(basename "$backup_file")",
  "size_bytes": $size,
  "compressed": $COMPRESS,
  "encrypted": $ENCRYPT,
  "verified": $VERIFY,
  "system_version": "11.0.0",
  "created_by": "$(whoami)"
}
EOF
    
    log OK "Metadata saved: $metadata_file"
}

#-------------------------------------------------------------------------------
# Main execution
#-------------------------------------------------------------------------------
main() {
    if [[ "$QUIET" != true ]]; then
        echo ""
        echo "==============================================================================="
        echo "ARI V11.0 BACKUP"
        echo "==============================================================================="
        echo ""
    fi
    
    validate_type
    setup_backup_dir
    
    log INFO "Starting $BACKUP_TYPE backup..."
    log INFO "Output directory: $BACKUP_DIR"
    
    local manifest_file
    manifest_file=$(get_backup_files)
    
    local backup_file
    backup_file=$(create_backup "$manifest_file")
    
    if [[ -n "$backup_file" && -f "$backup_file" ]]; then
        verify_backup "$backup_file"
        create_metadata "$backup_file"
        cleanup_old_backups
        
        if [[ "$QUIET" != true ]]; then
            echo ""
            echo "==============================================================================="
            echo -e "${GREEN}BACKUP COMPLETE${NC}"
            echo "==============================================================================="
            echo ""
            echo "  File: $backup_file"
            echo "  Type: $BACKUP_TYPE"
            echo "  Size: $(du -h "$backup_file" | cut -f1)"
            echo ""
        fi
    else
        log ERROR "Backup failed!"
        exit 1
    fi
}

main "$@"
