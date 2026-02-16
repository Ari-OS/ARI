---
name: ari-injection-detection
description: ARI's 27-pattern injection detection across 6 categories
triggers:
  - "injection detection"
  - "sanitize input"
  - "security patterns"
  - "content sanitization"
---

# ARI Injection Detection

## Purpose

Detect and block injection attacks using ARI's 27-pattern detection system across 6 categories.

## Pattern Categories

### 1. SQL Injection (4 patterns)
```typescript
const SQL_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b)/gi,
  /(--)|(\/\*.*\*\/)/g,
  /(\bOR\b|\bAND\b).*[=<>]/gi,
  /(;|\x00)/g
];
```

### 2. Command Injection (4 patterns)
```typescript
const COMMAND_PATTERNS = [
  /(;|\||`|\$\()/g,
  /(\b(rm|mv|cp|cat|chmod|chown|sudo|wget|curl)\b)/gi,
  /(>|>>|<)/g,
  /(\bnull\b|\/dev\/)/gi
];
```

### 3. Path Traversal (3 patterns)
```typescript
const PATH_PATTERNS = [
  /(\.\.\/|\.\.\\)/g,
  /(%2e%2e%2f|%252e%252e%252f)/gi,
  /(\/etc\/|\/var\/|\/usr\/)/gi
];
```

### 4. XSS Injection (4 patterns)
```typescript
const XSS_PATTERNS = [
  /(<script|<\/script|javascript:)/gi,
  /(on\w+\s*=)/gi,
  /(<iframe|<object|<embed)/gi,
  /(document\.|window\.|eval\()/gi
];
```

### 5. Prompt Injection (3 patterns)
```typescript
const PROMPT_PATTERNS = [
  /(ignore previous|disregard|forget)/gi,
  /(system prompt|new instructions)/gi,
  /(jailbreak|bypass|override)/gi
];
```

### 6. Data Exfiltration (3 patterns)
```typescript
const EXFIL_PATTERNS = [
  /(api[_-]?key|secret|password|token)/gi,
  /(base64|btoa|atob)/gi,
  /(fetch|xmlhttp|websocket)/gi
];
```

## Risk Scoring

```typescript
function assessRisk(content: string): RiskAssessment {
  let totalScore = 0;
  const detections: Detection[] = [];

  for (const category of CATEGORIES) {
    for (const pattern of category.patterns) {
      const matches = content.match(pattern);
      if (matches) {
        totalScore += category.weight * matches.length;
        detections.push({
          category: category.name,
          pattern: pattern.source,
          matches: matches.length
        });
      }
    }
  }

  return {
    score: Math.min(totalScore / 100, 1.0),
    detections,
    blocked: totalScore >= 80
  };
}
```

## Category Weights

| Category | Weight | Rationale |
|----------|--------|-----------|
| SQL Injection | 25 | Direct DB access |
| Command Injection | 30 | System execution |
| Path Traversal | 20 | File system access |
| XSS | 15 | Client-side risk |
| Prompt Injection | 20 | AI manipulation |
| Data Exfiltration | 20 | Data theft |

## Usage

```typescript
// In sanitizer.ts
const result = assessRisk(inputContent);

if (result.blocked) {
  eventBus.emit('security:injection_detected', {
    score: result.score,
    detections: result.detections
  });
  throw new SecurityError('Injection attempt blocked');
}

// Apply trust multiplier
const finalRisk = result.score * trustMultipliers[trustLevel];
```

## Shadow Integration

Per ARI's philosophy (Jung): Don't suppress, log and understand.

```typescript
// Even low-risk detections are logged
if (result.detections.length > 0) {
  eventBus.emit('audit:log', {
    action: 'injection_patterns_detected',
    score: result.score,
    blocked: result.blocked,
    detections: result.detections
  });
}
```

## Testing

```bash
# Run injection detection tests
npm test -- tests/security/injection-detection.test.ts

# Expected: 100% coverage on all 42 patterns
```
