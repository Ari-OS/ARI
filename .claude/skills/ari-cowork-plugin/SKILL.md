---
name: ari-cowork-plugin
displayName: Cowork Plugin Manager
description: Create, import, and manage Claude Cowork plugins
version: 1.0.0
author: system
permissions:
  - read_files
  - write_files
  - memory_write
trustRequired: operator
tools:
  - ari_plugin_import
  - ari_plugin_export
  - ari_plugin_generate
  - ari_plugin_list
triggers:
  - pattern: /ari-plugin
    confidence: 1.0
    isRegex: false
    priority: 100
  - pattern: cowork plugin
    confidence: 0.8
    isRegex: false
    priority: 50
  - pattern: create plugin
    confidence: 0.7
    isRegex: false
    priority: 40
tags:
  - cowork
  - plugins
  - integration
enabled: true
---

# Cowork Plugin Manager

Manage Claude Cowork plugins with ARI. This skill provides bidirectional integration with the Cowork ecosystem.

## Capabilities

### 1. Generate Plugins

Create domain-specific plugins from natural language descriptions.

**Supported Domains:**

- `sales` - Lead qualification, deal analysis, pipeline management
- `marketing` - Content strategy, campaign planning, analytics
- `finance` - Expense analysis, financial reporting, budgeting
- `legal` - Contract review, NDA triage, compliance
- `support` - Ticket triage, response generation, escalation
- `development` - Code review, architecture analysis, testing

**Example:**

```
Generate a plugin for sales team that helps with lead qualification and deal analysis
```

### 2. Import Plugins

Import existing Cowork plugins into ARI's skill system.

**Example:**

```
Import the plugin from ~/.ari/plugins/my-plugin/plugin.json
```

### 3. Export ARI as Plugin

Package ARI's capabilities as a distributable Cowork plugin.

**Example:**

```
Export ARI's research and development skills as a Cowork plugin
```

### 4. List Plugins

Show all imported plugins and their components.

**Example:**

```
List all installed Cowork plugins
```

## Security

- All imported plugins are sandboxed by default
- Network access is blocked (ARI security policy)
- Elevated permissions require governance approval
- All plugin operations are audited

## Plugin Format

Cowork plugins consist of:

- **Skills** - AI capabilities with instructions and triggers
- **Connectors** - Data source integrations
- **Commands** - Slash command shortcuts
- **Agents** - Specialized AI personas

## Output

Plugin operations return structured JSON with:

- Plugin metadata (id, name, version)
- Component counts
- Import/export status
- Any warnings or errors
