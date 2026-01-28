---
name: ari-backup-recovery
description: Backup and disaster recovery procedures for ARI
triggers:
  - "backup"
  - "restore"
  - "disaster recovery"
  - "data recovery"
---

# ARI Backup & Recovery

## Purpose

Ensure ARI's data integrity and availability through comprehensive backup and recovery procedures.

## Critical Data

| Data | Location | Criticality |
|------|----------|-------------|
| Audit trail | ~/.ari/audit.json | CRITICAL |
| Memory store | ~/.ari/memory/ | HIGH |
| Configuration | ~/.ari/config.json | HIGH |
| Venture data | ~/.ari/ventures/ | HIGH |
| Logs | ~/.ari/logs/ | MEDIUM |

## Backup Strategy

### Automated Backups

```typescript
// src/ops/backup.ts
interface BackupConfig {
  schedule: string;        // Cron expression
  retention: {
    daily: number;         // Days to keep daily backups
    weekly: number;        // Weeks to keep weekly backups
    monthly: number;       // Months to keep monthly backups
  };
  destination: string;     // Backup location
  encrypt: boolean;        // Encrypt backups
}

const defaultConfig: BackupConfig = {
  schedule: '0 2 * * *',   // 2 AM daily
  retention: {
    daily: 7,
    weekly: 4,
    monthly: 12
  },
  destination: '~/.ari/backups/',
  encrypt: true
};
```

### Backup Contents

```typescript
interface Backup {
  version: string;
  timestamp: string;
  checksum: string;
  contents: {
    audit: string;        // Compressed audit trail
    memory: string;       // Compressed memory store
    config: string;       // Configuration
    ventures: string[];   // Venture data
  };
  metadata: {
    auditEventCount: number;
    memoryEntries: number;
    lastAuditHash: string;
  };
}
```

## Backup Commands

```bash
# Create backup
npx ari backup create --output backup-2026-01-28.tar.gz

# Create encrypted backup
npx ari backup create --encrypt --password-file ~/.ari/backup-key

# List backups
npx ari backup list

# Verify backup integrity
npx ari backup verify backup-2026-01-28.tar.gz

# Restore from backup
npx ari backup restore backup-2026-01-28.tar.gz
```

## Backup Implementation

```typescript
async function createBackup(options: BackupOptions): Promise<BackupResult> {
  const backup: Backup = {
    version: VERSION,
    timestamp: new Date().toISOString(),
    checksum: '',
    contents: {},
    metadata: {}
  };

  // 1. Verify audit chain before backup
  const auditValid = await Audit.verifyChain();
  if (!auditValid.valid) {
    throw new Error('Cannot backup: audit chain invalid');
  }

  // 2. Collect data
  backup.contents.audit = await compress(await readAudit());
  backup.contents.memory = await compress(await readMemory());
  backup.contents.config = await readConfig();
  backup.contents.ventures = await collectVentureData();

  // 3. Calculate checksum
  backup.checksum = sha256(JSON.stringify(backup.contents));

  // 4. Encrypt if requested
  if (options.encrypt) {
    backup.contents = await encrypt(backup.contents, options.key);
  }

  // 5. Write backup
  await writeBackup(options.output, backup);

  // 6. Log to audit
  await eventBus.emit('audit:log', {
    action: 'backup_created',
    checksum: backup.checksum,
    timestamp: backup.timestamp
  });

  return { success: true, path: options.output, checksum: backup.checksum };
}
```

## Restore Procedure

```typescript
async function restore(backupPath: string, options: RestoreOptions): Promise<void> {
  // 1. Load and verify backup
  const backup = await loadBackup(backupPath);

  // 2. Verify checksum
  const checksum = sha256(JSON.stringify(backup.contents));
  if (checksum !== backup.checksum) {
    throw new Error('Backup checksum mismatch - backup may be corrupted');
  }

  // 3. Decrypt if encrypted
  if (backup.encrypted) {
    backup.contents = await decrypt(backup.contents, options.key);
  }

  // 4. Stop ARI daemon
  await daemon.stop();

  // 5. Backup current state (just in case)
  await createBackup({ output: 'pre-restore-backup.tar.gz' });

  // 6. Restore data
  await restoreAudit(decompress(backup.contents.audit));
  await restoreMemory(decompress(backup.contents.memory));
  await restoreConfig(backup.contents.config);
  await restoreVentures(backup.contents.ventures);

  // 7. Verify restored audit chain
  const valid = await Audit.verifyChain();
  if (!valid.valid) {
    throw new Error('Restored audit chain is invalid');
  }

  // 8. Restart daemon
  await daemon.start();

  // 9. Log restoration
  await eventBus.emit('audit:log', {
    action: 'backup_restored',
    backupTimestamp: backup.timestamp,
    restoredAt: new Date().toISOString()
  });
}
```

## Disaster Recovery

### Scenario 1: Corrupted Audit Trail

```bash
# 1. Stop ARI
npx ari daemon stop

# 2. Identify last valid backup
npx ari backup list

# 3. Verify backup
npx ari backup verify backup-2026-01-27.tar.gz

# 4. Restore
npx ari backup restore backup-2026-01-27.tar.gz

# 5. Verify
npx ari audit verify
npx ari doctor
```

### Scenario 2: System Failure

```bash
# On new system:
# 1. Install ARI
npm install -g ari

# 2. Restore from off-site backup
npx ari backup restore /path/to/backup.tar.gz

# 3. Verify
npx ari doctor

# 4. Start daemon
npx ari daemon start
```

### Scenario 3: Ransomware/Data Loss

```bash
# 1. Isolate system
# 2. Boot from clean image
# 3. Restore from air-gapped backup
# 4. Audit all recent activity
# 5. Report to security
```

## Backup Verification

```typescript
async function verifyBackup(path: string): Promise<VerificationResult> {
  const backup = await loadBackup(path);

  return {
    checksumValid: sha256(backup.contents) === backup.checksum,
    auditChainValid: await verifyAuditChain(backup.contents.audit),
    version: backup.version,
    timestamp: backup.timestamp,
    eventCount: backup.metadata.auditEventCount
  };
}
```

## Off-Site Backup

For critical deployments, maintain off-site backups:

```bash
# Sync to cloud storage (encrypted)
npx ari backup create --encrypt | aws s3 cp - s3://ari-backups/daily/

# Or local external drive
npx ari backup create --output /Volumes/Backup/ari/$(date +%Y%m%d).tar.gz
```
