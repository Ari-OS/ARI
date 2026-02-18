/**
 * Comprehensive injection detection patterns for ARI's sanitizer.
 *
 * Extracted from sanitizer.ts and expanded to 55+ patterns across 20+ categories.
 * Each pattern has an id, category, regex, severity, and human-readable description.
 *
 * @module kernel/sanitizer-patterns
 */

export interface InjectionPattern {
  id: string;
  category: string;
  pattern: RegExp;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
}

export const INJECTION_PATTERNS: InjectionPattern[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // Direct Override (1-3)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'DO-001',
    category: 'direct_override',
    pattern: /ignore\s+(all\s+)?(previous|prior|above)/i,
    severity: 'critical',
    description: 'Attempt to ignore previous instructions',
  },
  {
    id: 'DO-002',
    category: 'direct_override',
    pattern: /disregard\s+(all\s+)?(previous|prior|above)/i,
    severity: 'critical',
    description: 'Attempt to disregard previous instructions',
  },
  {
    id: 'DO-003',
    category: 'direct_override',
    pattern: /forget\s+(all\s+)?(previous|prior|above)/i,
    severity: 'critical',
    description: 'Attempt to forget previous instructions',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Role Manipulation (4-7)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'RM-001',
    category: 'role_manipulation',
    pattern: /you\s+are\s+now/i,
    severity: 'high',
    description: 'Attempt to redefine agent role',
  },
  {
    id: 'RM-002',
    category: 'role_manipulation',
    pattern: /act\s+as\s+(a\s+)?/i,
    severity: 'high',
    description: 'Attempt to change agent behavior',
  },
  {
    id: 'RM-003',
    category: 'role_manipulation',
    pattern: /pretend\s+(to\s+be|you'?re)/i,
    severity: 'high',
    description: 'Attempt to impersonate another entity',
  },
  {
    id: 'RM-004',
    category: 'role_manipulation',
    pattern: /new\s+identity/i,
    severity: 'high',
    description: 'Attempt to assign new identity',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Command Injection (8-11)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'CI-001',
    category: 'command',
    pattern: /\$\(.*\)/,
    severity: 'critical',
    description: 'Shell command substitution detected',
  },
  {
    id: 'CI-002',
    category: 'command',
    pattern: /`[^`]+`/,
    severity: 'critical',
    description: 'Backtick command execution detected',
  },
  {
    id: 'CI-003',
    category: 'command',
    pattern: /;\s*(rm|cat|curl|wget|eval|exec)\b/i,
    severity: 'critical',
    description: 'Chained shell command detected',
  },
  {
    id: 'CI-004',
    category: 'command',
    pattern: /\|\s*(bash|sh|zsh)\b/i,
    severity: 'critical',
    description: 'Pipe to shell interpreter detected',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Prompt Extraction (12-14)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'PE-001',
    category: 'prompt_extraction',
    pattern: /reveal\s+(your|the)\s+(system\s+)?prompt/i,
    severity: 'medium',
    description: 'Attempt to reveal system prompt',
  },
  {
    id: 'PE-002',
    category: 'prompt_extraction',
    pattern: /(show|print|display|output|dump)\s+(your|the)\s+(system\s+)?(instructions|prompt|rules)/i,
    severity: 'medium',
    description: 'Attempt to extract system instructions',
  },
  {
    id: 'PE-003',
    category: 'prompt_extraction',
    pattern: /what\s+are\s+your\s+(instructions|rules)/i,
    severity: 'medium',
    description: 'Attempt to extract system rules',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Authority Claims (15-17)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'AC-001',
    category: 'authority_claim',
    pattern: /as\s+(your|the)\s+(creator|developer|admin)/i,
    severity: 'high',
    description: 'False authority claim detected',
  },
  {
    id: 'AC-002',
    category: 'authority_claim',
    pattern: /i\s+(have|got)\s+(admin|root|sudo)/i,
    severity: 'high',
    description: 'Unauthorized privilege claim detected',
  },
  {
    id: 'AC-003',
    category: 'authority_claim',
    pattern: /override\s+(code|authority)/i,
    severity: 'high',
    description: 'Attempt to override system authority',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Data Exfiltration (18-21)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'DE-001',
    category: 'data_exfiltration',
    pattern: /send\s+(this|that|it|data|info)\s+to/i,
    severity: 'high',
    description: 'Attempt to send data externally',
  },
  {
    id: 'DE-002',
    category: 'data_exfiltration',
    pattern: /forward\s+(all|this|everything)\s+to/i,
    severity: 'high',
    description: 'Attempt to forward data externally',
  },
  {
    id: 'DE-003',
    category: 'data_exfiltration',
    pattern: /upload\s+(to|data)/i,
    severity: 'high',
    description: 'Attempt to upload data externally',
  },
  {
    id: 'DE-004',
    category: 'data_exfiltration',
    pattern: /exfiltrate/i,
    severity: 'critical',
    description: 'Explicit data exfiltration attempt',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SSRF (22-23)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'SSRF-001',
    category: 'ssrf',
    pattern: /file:\/\//i,
    severity: 'critical',
    description: 'File protocol SSRF attempt',
  },
  {
    id: 'SSRF-002',
    category: 'ssrf',
    pattern: /gopher:\/\/|dict:\/\//i,
    severity: 'critical',
    description: 'Dangerous protocol SSRF attempt',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Path Traversal (24-25)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'PT-001',
    category: 'path',
    pattern: /\.\.%2[fF]|\.\.%5[cC]/i,
    severity: 'high',
    description: 'URL-encoded path traversal detected',
  },
  {
    id: 'PT-002',
    category: 'path',
    pattern: /\.\.[/\\]/,
    severity: 'high',
    description: 'Directory traversal sequence detected',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Null Byte Injection (26)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'NB-001',
    category: 'null_byte',
    pattern: /%00|\\x00/i,
    severity: 'high',
    description: 'Null byte injection detected',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // XML Injection (27)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'XML-001',
    category: 'xml',
    pattern: /<!\[CDATA\[|<!ENTITY|<!DOCTYPE\s+\w+\s+SYSTEM/i,
    severity: 'high',
    description: 'XML entity/CDATA injection detected',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Jailbreak (28-30)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'JB-001',
    category: 'jailbreak',
    pattern: /\bDAN\s+mode\b/i,
    severity: 'critical',
    description: 'DAN jailbreak attempt detected',
  },
  {
    id: 'JB-002',
    category: 'jailbreak',
    pattern: /\b(developer|god|admin|debug)\s+mode\s+(enabled|activated|on)\b/i,
    severity: 'critical',
    description: 'Privilege escalation jailbreak detected',
  },
  {
    id: 'JB-003',
    category: 'jailbreak',
    pattern: /\bjailbreak(ed)?\b/i,
    severity: 'critical',
    description: 'Explicit jailbreak keyword detected',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Tag Injection / XSS (31-32)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'XSS-001',
    category: 'xss',
    pattern: /<\s*(system|script|iframe|object|embed|form|input|meta|link|base)\b/i,
    severity: 'high',
    description: 'Dangerous HTML/XML tag injection detected',
  },
  {
    id: 'XSS-002',
    category: 'xss',
    pattern: /on(load|error|click|mouseover|focus|blur|submit)\s*=/i,
    severity: 'high',
    description: 'HTML event handler injection detected',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Script Injection (33-35)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'SI-001',
    category: 'script',
    pattern: /\beval\s*\(/i,
    severity: 'critical',
    description: 'JavaScript eval injection detected',
  },
  {
    id: 'SI-002',
    category: 'script',
    pattern: /\b(atob|btoa)\s*\(/i,
    severity: 'high',
    description: 'Base64 encoding/decoding function detected',
  },
  {
    id: 'SI-003',
    category: 'script',
    pattern: /javascript\s*:/i,
    severity: 'critical',
    description: 'JavaScript protocol injection detected',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SQL Injection (36-39)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'SQL-001',
    category: 'sql',
    pattern: /'\s*(OR|AND)\s+('|1\s*=\s*1|true)/i,
    severity: 'critical',
    description: 'SQL boolean injection detected',
  },
  {
    id: 'SQL-002',
    category: 'sql',
    pattern: /;\s*(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|TRUNCATE)\s/i,
    severity: 'critical',
    description: 'SQL command injection detected',
  },
  {
    id: 'SQL-003',
    category: 'sql',
    pattern: /UNION\s+(ALL\s+)?SELECT/i,
    severity: 'critical',
    description: 'SQL UNION injection detected',
  },
  {
    id: 'SQL-004',
    category: 'sql',
    pattern: /--\s*$/m,
    severity: 'medium',
    description: 'SQL comment terminator detected',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // NEW PATTERNS (40+) — Phase 14 Security Hardening
  // ═══════════════════════════════════════════════════════════════════════

  // Unicode Homograph (40-41)
  {
    id: 'UH-001',
    category: 'unicode_homograph',
    pattern: /[\u0430\u0435\u043E\u0440\u0441\u0443\u0445]/,
    severity: 'high',
    description: 'Cyrillic homograph character detected (visual spoofing)',
  },
  {
    id: 'UH-002',
    category: 'unicode_homograph',
    pattern: /\u200B|\u200C|\u200D|\u2060|\uFEFF/,
    severity: 'medium',
    description: 'Zero-width character detected (invisible text injection)',
  },

  // Base64 Payload (42)
  {
    id: 'B64-001',
    category: 'encoded_payload',
    pattern: /Buffer\.from\s*\([^)]*,\s*['"]base64['"]/i,
    severity: 'high',
    description: 'Base64 Buffer decode detected (encoded payload)',
  },

  // CRLF Injection (43-44)
  {
    id: 'CRLF-001',
    category: 'crlf',
    pattern: /%0[dD]%0[aA]/,
    severity: 'high',
    description: 'URL-encoded CRLF injection detected',
  },
  {
    id: 'CRLF-002',
    category: 'crlf',
    pattern: /\r\n\r\n/,
    severity: 'high',
    description: 'Raw CRLF double newline injection (HTTP response splitting)',
  },

  // LDAP Injection (45-46)
  {
    id: 'LDAP-001',
    category: 'ldap',
    pattern: /\)\(cn=\*|\*\(\|?\(&/,
    severity: 'high',
    description: 'LDAP filter injection detected',
  },
  {
    id: 'LDAP-002',
    category: 'ldap',
    pattern: /\)\(\|/,
    severity: 'high',
    description: 'LDAP OR filter injection detected',
  },

  // XXE — XML External Entity (47-48)
  {
    id: 'XXE-001',
    category: 'xxe',
    pattern: /<!DOCTYPE\s+\w+\s*\[/i,
    severity: 'critical',
    description: 'DOCTYPE with internal subset (XXE vector)',
  },
  {
    id: 'XXE-002',
    category: 'xxe',
    pattern: /SYSTEM\s+["']file:\/\//i,
    severity: 'critical',
    description: 'XXE file:// entity reference detected',
  },

  // Server-Side Template Injection (49-50)
  {
    id: 'SSTI-001',
    category: 'template',
    pattern: /\{\{constructor\.constructor/,
    severity: 'critical',
    description: 'Template prototype chain access (SSTI)',
  },
  {
    id: 'SSTI-002',
    category: 'template',
    pattern: /\{%\s*(import|include|extends)\b/i,
    severity: 'high',
    description: 'Jinja/Twig template directive injection',
  },

  // NoSQL Injection (51-52)
  {
    id: 'NOSQL-001',
    category: 'nosql',
    pattern: /\{\s*"\$gt"\s*:/,
    severity: 'critical',
    description: 'NoSQL $gt operator injection detected',
  },
  {
    id: 'NOSQL-002',
    category: 'nosql',
    pattern: /\{\s*"\$(ne|regex|where|exists)"\s*:/,
    severity: 'critical',
    description: 'NoSQL query operator injection detected',
  },

  // Prototype Pollution (53-54)
  {
    id: 'PROTO-001',
    category: 'proto',
    pattern: /__proto__/,
    severity: 'critical',
    description: 'Prototype pollution via __proto__ detected',
  },
  {
    id: 'PROTO-002',
    category: 'proto',
    pattern: /constructor\s*\[\s*['"]prototype['"]\s*\]/,
    severity: 'critical',
    description: 'Prototype pollution via constructor.prototype detected',
  },

  // Log Injection (55)
  {
    id: 'LOG-001',
    category: 'log_injection',
    pattern: /\n\s*\[?(INFO|WARN|ERROR|DEBUG|FATAL)\]?\s/i,
    severity: 'medium',
    description: 'Log injection via embedded log-level prefix',
  },

  // Deserialization (56)
  {
    id: 'DESER-001',
    category: 'deserialization',
    pattern: /rO0ABX|aced0005/i,
    severity: 'critical',
    description: 'Java serialized object magic bytes detected',
  },

  // GraphQL Introspection (57-58)
  {
    id: 'GQL-001',
    category: 'graphql',
    pattern: /__schema\s*\{/,
    severity: 'medium',
    description: 'GraphQL introspection query detected',
  },
  {
    id: 'GQL-002',
    category: 'graphql',
    pattern: /__type\s*\(/,
    severity: 'medium',
    description: 'GraphQL type introspection detected',
  },

  // JWT Manipulation (59-60)
  {
    id: 'JWT-001',
    category: 'jwt',
    pattern: /["']alg["']\s*:\s*["']none["']/i,
    severity: 'critical',
    description: 'JWT algorithm "none" attack detected',
  },
  {
    id: 'JWT-002',
    category: 'jwt',
    pattern: /eyJhbGciOiJub25lIi/,
    severity: 'critical',
    description: 'Base64-encoded JWT with alg:none detected',
  },

  // Additional Prompt Injection (61-63)
  {
    id: 'PI-001',
    category: 'prompt',
    pattern: /system\s+prompt\s*:/i,
    severity: 'critical',
    description: 'Attempt to inject system prompt directive',
  },
  {
    id: 'PI-002',
    category: 'prompt',
    pattern: /new\s+instructions?\s*:/i,
    severity: 'critical',
    description: 'Attempt to inject new instructions',
  },
  {
    id: 'PI-003',
    category: 'prompt',
    pattern: /\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>/i,
    severity: 'critical',
    description: 'Chat template delimiter injection detected',
  },
];

/**
 * Get patterns by category.
 */
export function getPatternsByCategory(category: string): InjectionPattern[] {
  return INJECTION_PATTERNS.filter(p => p.category === category);
}

/**
 * Get patterns by severity.
 */
export function getPatternsBySeverity(severity: InjectionPattern['severity']): InjectionPattern[] {
  return INJECTION_PATTERNS.filter(p => p.severity === severity);
}

/**
 * Get all unique categories.
 */
export function getCategories(): string[] {
  return [...new Set(INJECTION_PATTERNS.map(p => p.category))];
}

/**
 * Severity weight mapping for risk score calculation.
 */
export const SEVERITY_WEIGHTS: Record<InjectionPattern['severity'], number> = {
  low: 1,
  medium: 3,
  high: 5,
  critical: 10,
};
