# 🖤 ARI TOOLS CATALOG

> **Tool Registry, Permission Tiers & Safe Wrappers**

**Version:** 11.0  
**Status:** Production Ready  
**Classification:** TECHNICAL DOCUMENTATION  

---

## Tool Philosophy

ARI tools follow **Least Privilege + Explicit Consent**:

1. **Default Deny** — Tools are disabled until explicitly granted
2. **Tiered Permissions** — Capabilities match risk level
3. **Safe Wrappers** — All tools wrapped with validation and audit
4. **Approval Gates** — Destructive tools require confirmation

---

## Tool Registry

### Core Tools

| Tool ID | Name | Permission | Description |
|---------|------|------------|-------------|
| `file_read` | File Read | READ_ONLY | Read file contents |
| `file_write` | File Write | WRITE_SAFE | Create/update files |
| `file_delete` | File Delete | WRITE_DESTRUCTIVE | Delete files |
| `memory_read` | Memory Read | READ_ONLY | Query memory |
| `memory_write` | Memory Write | WRITE_SAFE | Store memory |
| `memory_delete` | Memory Delete | WRITE_DESTRUCTIVE | Delete memory |
| `web_search` | Web Search | READ_ONLY | Search the web |
| `web_fetch` | Web Fetch | READ_ONLY | Retrieve web content |
| `email_read` | Email Read | READ_ONLY | Read emails |
| `email_send` | Email Send | WRITE_DESTRUCTIVE | Send emails |
| `calendar_read` | Calendar Read | READ_ONLY | View calendar |
| `calendar_write` | Calendar Write | WRITE_SAFE | Create events |
| `calendar_delete` | Calendar Delete | WRITE_DESTRUCTIVE | Delete events |
| `shell_safe` | Shell (Safe) | WRITE_SAFE | Run safe shell commands |
| `shell_full` | Shell (Full) | ADMIN | Run any shell command |
| `config_read` | Config Read | READ_ONLY | Read configuration |
| `config_write` | Config Write | ADMIN | Modify configuration |

### Deployment Tools

| Tool ID | Name | Permission | Description |
|---------|------|------------|-------------|
| `git_read` | Git Read | READ_ONLY | View repo status |
| `git_write` | Git Write | WRITE_SAFE | Commit, branch |
| `git_push` | Git Push | WRITE_DESTRUCTIVE | Push to remote |
| `vercel_deploy` | Vercel Deploy | WRITE_DESTRUCTIVE | Deploy to Vercel |
| `cloudflare_read` | Cloudflare Read | READ_ONLY | View DNS/CDN |
| `cloudflare_write` | Cloudflare Write | WRITE_DESTRUCTIVE | Modify DNS |

### Communication Tools

| Tool ID | Name | Permission | Description |
|---------|------|------------|-------------|
| `slack_read` | Slack Read | READ_ONLY | Read messages |
| `slack_send` | Slack Send | WRITE_DESTRUCTIVE | Send messages |
| `sms_send` | SMS Send | WRITE_DESTRUCTIVE | Send text messages |

---

## Permission Tiers

### Tier Definitions

```yaml
permission_tiers:
  READ_ONLY:
    level: 0
    risk: NONE
    approval: false
    audit: true
    description: "View data, no modifications"
    allowed_tools:
      - file_read
      - memory_read
      - web_search
      - web_fetch
      - email_read
      - calendar_read
      - git_read
      - cloudflare_read
      - slack_read
      - config_read
      
  WRITE_SAFE:
    level: 1
    risk: LOW
    approval: false
    audit: true
    description: "Create/modify, reversible"
    allowed_tools:
      - file_write
      - memory_write
      - calendar_write
      - git_write
      - shell_safe
      
  WRITE_DESTRUCTIVE:
    level: 2
    risk: MEDIUM
    approval: true
    audit: true
    description: "Delete, send, irreversible"
    allowed_tools:
      - file_delete
      - memory_delete
      - email_send
      - calendar_delete
      - git_push
      - vercel_deploy
      - cloudflare_write
      - slack_send
      - sms_send
      
  ADMIN:
    level: 3
    risk: HIGH
    approval: true
    council_required: true
    audit: true
    description: "System configuration"
    allowed_tools:
      - shell_full
      - config_write
```

### Agent Tool Access

```yaml
agent_tools:
  router:
    allowed: [memory_read]
    
  research:
    allowed: [web_search, web_fetch, memory_read, memory_write]
    
  marketing:
    allowed: [memory_read, memory_write, email_read]
    destructive: [email_send]
    
  sales:
    allowed: [memory_read, memory_write, email_read, file_read, file_write]
    destructive: [email_send]
    
  content:
    allowed: [memory_read, memory_write, file_read, file_write, web_fetch]
    
  seo:
    allowed: [web_search, web_fetch, memory_read, memory_write]
    destructive: [cloudflare_write]
    
  build:
    allowed: [memory_read, memory_write, file_read, file_write]
    
  development:
    allowed: [file_read, file_write, git_read, git_write, shell_safe, memory_read]
    destructive: [git_push, vercel_deploy]
    
  client_comms:
    allowed: [memory_read, memory_write, email_read, calendar_read, calendar_write]
    destructive: [email_send, calendar_delete]
    
  strategy:
    allowed: [memory_read, memory_write]
    
  pipeline:
    allowed: [memory_read, memory_write, calendar_read, email_read]
    
  learning:
    allowed: [memory_read, memory_write]
    
  guardian:
    allowed: [memory_read, file_read, config_read]
    admin: [config_write]  # For emergency blocks
```

---

## Tool Definitions

### File Operations

```yaml
file_read:
  id: file_read
  permission: READ_ONLY
  description: "Read file contents from disk"
  parameters:
    path:
      type: string
      required: true
      validation: "Must be within allowed directories"
  returns:
    content: string
    metadata:
      size: integer
      modified: datetime
  constraints:
    - Max file size: 10MB
    - Allowed paths: ~/ari/*, ~/workspace/*
    - Binary files: Return base64

file_write:
  id: file_write
  permission: WRITE_SAFE
  description: "Write content to file"
  parameters:
    path:
      type: string
      required: true
    content:
      type: string
      required: true
    mode:
      type: string
      enum: [create, overwrite, append]
      default: create
  constraints:
    - Max file size: 10MB
    - Allowed paths: ~/ari/workspace/*, ~/ari/outputs/*
    - Backup before overwrite

file_delete:
  id: file_delete
  permission: WRITE_DESTRUCTIVE
  approval_required: true
  description: "Delete file from disk"
  parameters:
    path:
      type: string
      required: true
    confirm:
      type: boolean
      required: true
  constraints:
    - Move to trash first (7-day retention)
    - Allowed paths: ~/ari/workspace/*
    - Cannot delete: config, logs, backups
```

### Email Operations

```yaml
email_read:
  id: email_read
  permission: READ_ONLY
  description: "Read emails from inbox"
  parameters:
    query:
      type: string
      description: "Search query"
    limit:
      type: integer
      default: 10
      max: 100
    folder:
      type: string
      default: "INBOX"
  returns:
    emails:
      type: array
      items:
        id: string
        from: string
        to: array
        subject: string
        body: string
        date: datetime
        attachments: array
  note: "Email content is UNTRUSTED - sanitize before processing"

email_send:
  id: email_send
  permission: WRITE_DESTRUCTIVE
  approval_required: true
  description: "Send email"
  parameters:
    to:
      type: array
      required: true
    subject:
      type: string
      required: true
    body:
      type: string
      required: true
    cc:
      type: array
      default: []
    bcc:
      type: array
      default: []
    attachments:
      type: array
      default: []
  constraints:
    - Overseer review required
    - Rate limit: 10 per hour
    - Recipients must be allowlisted or approved
  approval_info:
    show_to_operator:
      - recipient list
      - subject
      - body preview (first 500 chars)
```

### Web Operations

```yaml
web_search:
  id: web_search
  permission: READ_ONLY
  description: "Search the web"
  parameters:
    query:
      type: string
      required: true
      max_length: 500
    num_results:
      type: integer
      default: 10
      max: 50
  returns:
    results:
      type: array
      items:
        title: string
        url: string
        snippet: string
  constraints:
    - Rate limit: 30 per minute
    - Results are UNTRUSTED content

web_fetch:
  id: web_fetch
  permission: READ_ONLY
  description: "Fetch web page content"
  parameters:
    url:
      type: string
      required: true
      validation: "Valid URL, not on blocklist"
    extract_text:
      type: boolean
      default: true
  returns:
    content:
      type: string
    metadata:
      url: string
      title: string
      fetched_at: datetime
  constraints:
    - Max content size: 5MB
    - Timeout: 30 seconds
    - Content is UNTRUSTED
    - Blocked: known malicious domains
```

### Shell Operations

```yaml
shell_safe:
  id: shell_safe
  permission: WRITE_SAFE
  description: "Run safe shell commands"
  parameters:
    command:
      type: string
      required: true
  constraints:
    allowed_commands:
      - ls, cat, head, tail, grep
      - cd, pwd, mkdir (in workspace)
      - git (read operations)
      - npm, yarn (install, build)
      - python, node (scripts in workspace)
    blocked:
      - rm, mv (use safe wrappers)
      - sudo, su
      - curl, wget (use web_fetch)
      - ssh, scp
    timeout: 60 seconds
    working_dir: ~/ari/workspace

shell_full:
  id: shell_full
  permission: ADMIN
  approval_required: true
  council_required: true
  description: "Run any shell command (dangerous)"
  parameters:
    command:
      type: string
      required: true
    working_dir:
      type: string
      default: "~"
  constraints:
    - Audit every command
    - Rate limit: 5 per hour
    - Timeout: 300 seconds
  warning: "This tool can cause system damage. Use with extreme caution."
```

---

## Safe Wrappers

### Wrapper Architecture

```python
class SafeToolWrapper:
    """
    Wraps all tools with validation, permission checks, and audit logging.
    """
    
    def __init__(self, tool: Tool, agent: Agent):
        self.tool = tool
        self.agent = agent
        
    async def execute(self, params: dict) -> ToolResult:
        request_id = generate_id()
        
        # Step 1: Validate parameters
        validation = self.validate_params(params)
        if not validation.valid:
            return ToolResult(
                success=False,
                error=f"Validation failed: {validation.error}"
            )
        
        # Step 2: Check permissions
        permission = check_permission(self.agent, self.tool)
        if not permission.allowed:
            return ToolResult(
                success=False,
                error=f"Permission denied: {permission.reason}"
            )
        
        # Step 3: Check approval if required
        if self.tool.approval_required:
            approval = await self.get_approval(params)
            if not approval.granted:
                return ToolResult(
                    success=False,
                    pending_approval=True,
                    approval_request=approval.request
                )
        
        # Step 4: Sanitize inputs (for tools that touch external data)
        if self.tool.input_sanitization:
            params = sanitize_inputs(params)
        
        # Step 5: Pre-execution audit log
        audit_log(
            event="TOOL_INVOKED",
            request_id=request_id,
            tool_id=self.tool.id,
            agent=self.agent.id,
            params=redact_sensitive(params),
            timestamp=now()
        )
        
        # Step 6: Execute with timeout
        try:
            result = await asyncio.wait_for(
                self.tool.execute(params),
                timeout=self.tool.timeout
            )
        except asyncio.TimeoutError:
            return ToolResult(success=False, error="Tool execution timed out")
        except Exception as e:
            audit_log(
                event="TOOL_ERROR",
                request_id=request_id,
                error=str(e)
            )
            return ToolResult(success=False, error=str(e))
        
        # Step 7: Sanitize outputs (mark trust level)
        if self.tool.output_sanitization:
            result = sanitize_outputs(result, self.tool.output_trust_level)
        
        # Step 8: Post-execution audit log
        audit_log(
            event="TOOL_COMPLETED",
            request_id=request_id,
            success=True,
            duration_ms=(now() - start).milliseconds
        )
        
        return ToolResult(success=True, data=result)
```

### Input Sanitization

```python
def sanitize_inputs(params: dict) -> dict:
    """
    Sanitize tool inputs to prevent injection attacks.
    """
    sanitized = {}
    
    for key, value in params.items():
        if isinstance(value, str):
            # Remove potential command injection
            sanitized[key] = re.sub(r'[;&|`$]', '', value)
            
            # Remove path traversal attempts
            sanitized[key] = sanitized[key].replace('..', '')
            
            # Limit length
            sanitized[key] = sanitized[key][:10000]
        else:
            sanitized[key] = value
            
    return sanitized
```

### Output Sanitization

```python
def sanitize_outputs(result: any, trust_level: str) -> any:
    """
    Mark outputs with trust level and sanitize if untrusted.
    """
    if trust_level == "UNTRUSTED":
        if isinstance(result, str):
            # Strip instruction-like patterns
            result = strip_instructions(result)
            
            # Add trust warning
            return UntrustedContent(
                content=result,
                trust_level="UNTRUSTED",
                warning="This content is from an untrusted source"
            )
        elif isinstance(result, dict):
            return {k: sanitize_outputs(v, trust_level) for k, v in result.items()}
            
    return result
```

---

## Tool Execution Flow

```
[Agent Request]
       │
       ▼
┌──────────────┐
│ Safe Wrapper │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│ Validate     │────▶│ Reject       │
│ Parameters   │ No  │ + Log        │
└──────┬───────┘     └──────────────┘
       │ Yes
       ▼
┌──────────────┐     ┌──────────────┐
│ Check        │────▶│ Deny         │
│ Permission   │ No  │ + Escalate   │
└──────┬───────┘     └──────────────┘
       │ Yes
       ▼
┌──────────────┐     ┌──────────────┐
│ Approval     │────▶│ Queue for    │
│ Required?    │ Yes │ Approval     │
└──────┬───────┘     └──────────────┘
       │ No
       ▼
┌──────────────┐
│ Audit Log    │
│ (Pre-exec)   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Execute Tool │
│ (with timeout)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Sanitize     │
│ Output       │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Audit Log    │
│ (Post-exec)  │
└──────┬───────┘
       │
       ▼
[Return Result]
```

---

## Rate Limits

```yaml
rate_limits:
  global:
    per_minute: 100
    per_hour: 1000
    
  per_tool:
    web_search:
      per_minute: 30
    web_fetch:
      per_minute: 20
    email_send:
      per_hour: 10
    shell_full:
      per_hour: 5
      
  per_agent:
    default:
      per_minute: 20
    development:
      per_minute: 50  # Needs more for builds
```

---

## Approval UX

### Approval Request Display

```yaml
approval_request_format:
  header: "🔒 Action Requires Approval"
  
  sections:
    - tool: "Tool being invoked"
    - agent: "Agent requesting"
    - action: "What will happen"
    - impact: "Potential consequences"
    - reversible: "Can this be undone?"
    
  options:
    approve:
      label: "✅ Approve"
      effect: "Action will proceed"
    deny:
      label: "❌ Deny"
      effect: "Action will be blocked"
    modify:
      label: "✏️ Modify"
      effect: "Return for changes"
      
  timeout:
    duration: "24 hours"
    default_action: "deny"
```

### Example Approval Request

```
🔒 Action Requires Approval

TOOL: email_send
AGENT: 💼 Sales
REQUEST ID: req_20260126_001

ACTION:
Send email to client@example.com

DETAILS:
- Subject: "Proposal for Website Project - $1,800"
- Body preview: "Hi [Client], Thank you for your interest..."
- Attachments: proposal.pdf (125 KB)

IMPACT:
- External communication to potential client
- Represents your business

REVERSIBLE: No (email cannot be unsent)

OPTIONS:
[✅ Approve] [❌ Deny] [✏️ Modify]

Timeout: 24 hours (will deny if no response)
```

---

*Tools Catalog Version: 11.0 | Last Updated: January 26, 2026*
