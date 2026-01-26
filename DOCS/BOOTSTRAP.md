# 🖤 ARI BOOTSTRAP GUIDE

> **Complete Setup Instructions for Mac mini**

**Version:** 11.0  
**Target Platform:** macOS 14+ (Sonoma)  
**Estimated Time:** 30-45 minutes  

---

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] Mac mini with macOS 14 (Sonoma) or later
- [ ] Admin access to the machine
- [ ] Internet connection
- [ ] Anthropic API key (Claude)
- [ ] Text editor (VS Code recommended)
- [ ] Terminal access

---

## Part 1: System Preparation

### 1.1 Install Homebrew

Open Terminal and run:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

After installation, add to PATH:

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

Verify:

```bash
brew --version
# Should show: Homebrew 4.x.x
```

### 1.2 Install Required Software

```bash
# Python 3.11+
brew install python@3.11

# Node.js 20+
brew install node@20

# Git
brew install git

# SQLite (usually pre-installed, but ensure latest)
brew install sqlite

# jq (JSON processing)
brew install jq
```

Verify installations:

```bash
python3 --version   # Python 3.11+
node --version      # v20.x.x
git --version       # git version 2.x.x
sqlite3 --version   # 3.x.x
```

### 1.3 Create Directory Structure

```bash
# Create ARI home directory
mkdir -p ~/ari
cd ~/ari

# Create subdirectories
mkdir -p config
mkdir -p memory
mkdir -p logs
mkdir -p backups
mkdir -p workspace
mkdir -p outputs
mkdir -p scripts

# Set permissions
chmod 700 ~/ari
chmod 700 ~/ari/config
chmod 700 ~/ari/memory
chmod 700 ~/ari/backups
```

---

## Part 2: Clone Repository

### 2.1 Clone ARI Foundation

```bash
cd ~/ari
git clone https://github.com/pryceless/ari-foundation.git foundation
```

### 2.2 Verify Structure

```bash
ls -la ~/ari/foundation/
# Should show: README.md, MANIFEST.md, PROMPTS/, CONFIG/, etc.
```

---

## Part 3: Configure Environment

### 3.1 Set Up Environment Variables

Create environment file:

```bash
cat > ~/ari/.env << 'EOF'
# ARI Environment Configuration
# Created: $(date)

# API Keys (REQUIRED)
ANTHROPIC_API_KEY=your-api-key-here

# ARI Configuration
ARI_HOME=/Users/$(whoami)/ari
ARI_LOG_LEVEL=INFO
ARI_AUDIT_ENABLED=true

# Security
ARI_ENCRYPTION_KEY=$(openssl rand -hex 32)
ARI_SIGNING_KEY=$(openssl rand -hex 32)

# Optional Integrations
# VERCEL_TOKEN=your-vercel-token
# CLOUDFLARE_TOKEN=your-cloudflare-token
# SMTP_PASSWORD=your-smtp-password
EOF
```

**IMPORTANT:** Edit the file and add your real Anthropic API key:

```bash
nano ~/ari/.env
# Replace 'your-api-key-here' with your actual key
# Save: Ctrl+O, Enter, Ctrl+X
```

### 3.2 Load Environment

Add to shell profile:

```bash
echo 'source ~/ari/.env' >> ~/.zprofile
source ~/ari/.env
```

Verify:

```bash
echo $ARI_HOME
# Should show: /Users/yourusername/ari
```

### 3.3 Configure Git

```bash
git config --global user.name "Pryce Hedrick"
git config --global user.email "your-email@example.com"
```

---

## Part 4: Install Dependencies

### 4.1 Python Environment

```bash
cd ~/ari

# Create virtual environment
python3 -m venv venv

# Activate
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install anthropic sqlite-utils python-dotenv pyyaml aiofiles
```

### 4.2 Create Requirements File

```bash
cat > ~/ari/requirements.txt << 'EOF'
anthropic>=0.18.0
sqlite-utils>=3.35
python-dotenv>=1.0.0
pyyaml>=6.0
aiofiles>=23.0
asyncio>=3.4.3
EOF
```

---

## Part 5: Initialize Database

### 5.1 Create Memory Database

```bash
cd ~/ari

# Create SQLite database
sqlite3 memory/ari.db << 'EOF'
-- ARI Memory Schema

CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    provenance_source TEXT,
    provenance_trust TEXT,
    provenance_agent TEXT,
    confidence REAL DEFAULT 0.5,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    expires_at DATETIME,
    approved_by TEXT,
    hash TEXT,
    supersedes TEXT,
    tags TEXT,
    access_count INTEGER DEFAULT 0,
    last_accessed DATETIME
);

CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    type TEXT NOT NULL,
    agent TEXT,
    action TEXT,
    input TEXT,
    output TEXT,
    metadata TEXT
);

CREATE TABLE IF NOT EXISTS checkpoints (
    id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    label TEXT,
    size_bytes INTEGER,
    path TEXT
);

CREATE INDEX idx_memories_type ON memories(type);
CREATE INDEX idx_memories_created ON memories(created_at);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX idx_audit_type ON audit_log(type);

.quit
EOF
```

### 5.2 Verify Database

```bash
sqlite3 ~/ari/memory/ari.db ".tables"
# Should show: audit_log  checkpoints  memories
```

---

## Part 6: Copy Configuration

### 6.1 Copy Default Configs

```bash
cp ~/ari/foundation/CONFIG/*.json ~/ari/config/
```

### 6.2 Customize Config

Edit defaults.json:

```bash
cat > ~/ari/config/defaults.json << 'EOF'
{
  "version": "11.0",
  "operator": {
    "name": "Pryce Hedrick",
    "timezone": "America/Indiana/Indianapolis"
  },
  "system": {
    "log_level": "INFO",
    "audit_enabled": true,
    "max_memory_entries": 10000,
    "backup_retention_days": 30
  },
  "security": {
    "default_trust_level": "UNTRUSTED",
    "require_approval_for_destructive": true,
    "sanitize_external_content": true
  },
  "limits": {
    "max_request_size_mb": 1,
    "tool_timeout_seconds": 30,
    "api_requests_per_minute": 60
  }
}
EOF
```

---

## Part 7: Create Startup Scripts

### 7.1 Bootstrap Script

```bash
cat > ~/ari/scripts/bootstrap.sh << 'EOF'
#!/bin/bash
# ARI Bootstrap Script

set -e

echo "🖤 ARI Bootstrap Starting..."

# Check environment
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "❌ ERROR: ANTHROPIC_API_KEY not set"
    exit 1
fi

# Activate virtual environment
source ~/ari/venv/bin/activate

# Verify dependencies
python3 -c "import anthropic; print('✓ Anthropic SDK')"
python3 -c "import sqlite3; print('✓ SQLite')"
python3 -c "import yaml; print('✓ YAML')"

# Verify database
if [ -f ~/ari/memory/ari.db ]; then
    echo "✓ Memory database exists"
else
    echo "❌ Memory database missing"
    exit 1
fi

# Verify config
if [ -f ~/ari/config/defaults.json ]; then
    echo "✓ Configuration exists"
else
    echo "❌ Configuration missing"
    exit 1
fi

echo ""
echo "🖤 ARI Bootstrap Complete"
echo "   Ready to start with: ~/ari/scripts/start.sh"
EOF

chmod +x ~/ari/scripts/bootstrap.sh
```

### 7.2 Start Script

```bash
cat > ~/ari/scripts/start.sh << 'EOF'
#!/bin/bash
# ARI Start Script

echo "🖤 Starting ARI v11.0..."

# Load environment
source ~/ari/.env

# Activate Python environment
source ~/ari/venv/bin/activate

# Verify bootstrap
~/ari/scripts/bootstrap.sh || exit 1

echo ""
echo "🖤 ARI v11.0 ACTIVE"
echo ""
echo "System: Constitutional Multi-Agent OS"
echo "Operator: ${ARI_OPERATOR:-Pryce Hedrick}"
echo "Home: $ARI_HOME"
echo ""
echo "Ready for instructions."
echo ""

# Start interactive mode (placeholder - implement as needed)
# python3 ~/ari/foundation/src/main.py
EOF

chmod +x ~/ari/scripts/start.sh
```

### 7.3 Backup Script

```bash
cat > ~/ari/scripts/backup.sh << 'EOF'
#!/bin/bash
# ARI Backup Script

BACKUP_DIR=~/ari/backups
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="ari_backup_${TIMESTAMP}"

echo "🖤 Creating backup: ${BACKUP_NAME}"

# Create backup directory
mkdir -p "${BACKUP_DIR}/${BACKUP_NAME}"

# Backup database
cp ~/ari/memory/ari.db "${BACKUP_DIR}/${BACKUP_NAME}/ari.db"

# Backup config
cp -r ~/ari/config "${BACKUP_DIR}/${BACKUP_NAME}/"

# Compress
cd ${BACKUP_DIR}
tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}"
rm -rf "${BACKUP_NAME}"

# Cleanup old backups (keep 30 days)
find ${BACKUP_DIR} -name "*.tar.gz" -mtime +30 -delete

echo "✓ Backup complete: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
EOF

chmod +x ~/ari/scripts/backup.sh
```

### 7.4 Verify Script

```bash
cat > ~/ari/scripts/verify.sh << 'EOF'
#!/bin/bash
# ARI Verification Script

echo "🖤 ARI System Verification"
echo "========================="

PASS=0
FAIL=0

check() {
    if [ $1 -eq 0 ]; then
        echo "✓ $2"
        ((PASS++))
    else
        echo "❌ $2"
        ((FAIL++))
    fi
}

# Environment
[ -n "$ANTHROPIC_API_KEY" ]
check $? "ANTHROPIC_API_KEY set"

[ -n "$ARI_HOME" ]
check $? "ARI_HOME set"

# Directories
[ -d ~/ari/config ]
check $? "Config directory exists"

[ -d ~/ari/memory ]
check $? "Memory directory exists"

[ -d ~/ari/logs ]
check $? "Logs directory exists"

[ -d ~/ari/backups ]
check $? "Backups directory exists"

# Files
[ -f ~/ari/memory/ari.db ]
check $? "Memory database exists"

[ -f ~/ari/config/defaults.json ]
check $? "Default config exists"

# Python
source ~/ari/venv/bin/activate 2>/dev/null
check $? "Python venv activates"

python3 -c "import anthropic" 2>/dev/null
check $? "Anthropic SDK installed"

echo ""
echo "========================="
echo "Passed: $PASS"
echo "Failed: $FAIL"

if [ $FAIL -gt 0 ]; then
    echo ""
    echo "⚠️  Some checks failed. Review and fix before starting ARI."
    exit 1
else
    echo ""
    echo "✓ All checks passed. ARI is ready."
    exit 0
fi
EOF

chmod +x ~/ari/scripts/verify.sh
```

---

## Part 8: Final Verification

### 8.1 Run Verification

```bash
~/ari/scripts/verify.sh
```

Expected output:

```
🖤 ARI System Verification
=========================
✓ ANTHROPIC_API_KEY set
✓ ARI_HOME set
✓ Config directory exists
✓ Memory directory exists
✓ Logs directory exists
✓ Backups directory exists
✓ Memory database exists
✓ Default config exists
✓ Python venv activates
✓ Anthropic SDK installed

=========================
Passed: 10
Failed: 0

✓ All checks passed. ARI is ready.
```

### 8.2 Run Bootstrap

```bash
~/ari/scripts/bootstrap.sh
```

### 8.3 Test Start

```bash
~/ari/scripts/start.sh
```

---

## Part 9: Post-Installation

### 9.1 Set Up Scheduled Backups

```bash
# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * ~/ari/scripts/backup.sh >> ~/ari/logs/backup.log 2>&1") | crontab -
```

### 9.2 Create Alias

```bash
echo 'alias ari="~/ari/scripts/start.sh"' >> ~/.zprofile
source ~/.zprofile
```

Now you can start ARI with just:

```bash
ari
```

### 9.3 Review Documentation

Read these files for operational knowledge:

- `~/ari/foundation/RUNBOOK.md` — Day-2 operations
- `~/ari/foundation/SECURITY.md` — Security policies
- `~/ari/foundation/TOOLS.md` — Available capabilities

---

## Troubleshooting

### API Key Issues

```bash
# Verify key is set
echo $ANTHROPIC_API_KEY

# Test API
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-sonnet-20240229","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

### Database Issues

```bash
# Check database
sqlite3 ~/ari/memory/ari.db ".schema"

# Recreate if corrupted
rm ~/ari/memory/ari.db
# Run database creation commands from Part 5
```

### Permission Issues

```bash
# Fix permissions
chmod 700 ~/ari
chmod 700 ~/ari/config
chmod 700 ~/ari/memory
chmod +x ~/ari/scripts/*.sh
```

---

## Security Reminders

After installation:

1. **Protect your API key** — Never commit to git, never share
2. **Backup regularly** — Automated daily, manual before changes
3. **Review audit logs** — Check `~/ari/logs/` periodically
4. **Update dependencies** — `pip install --upgrade -r requirements.txt`
5. **Keep system updated** — `softwareupdate -ia` on macOS

---

## Next Steps

1. **Read the documentation** — Understand how ARI works
2. **Test basic operations** — Simple queries first
3. **Configure tools** — Enable what you need
4. **Set up integrations** — Email, calendar, etc.
5. **Customize prompts** — Adjust agent behaviors

---

*Bootstrap Guide Version: 11.0 | Last Updated: January 26, 2026*
