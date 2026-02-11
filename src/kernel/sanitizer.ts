import type { TrustLevel, SanitizeResult } from './types.js';

type Severity = 'low' | 'medium' | 'high' | 'critical';

interface InjectionPattern {
  pattern: RegExp;
  category: string;
  severity: Severity;
  description: string;
}

/**
 * Comprehensive injection patterns organized by attack category
 */
export const INJECTION_PATTERNS: readonly InjectionPattern[] = [
  // Direct Override patterns
  {
    pattern: /ignore\s+(all\s+)?(previous|prior|above)/i,
    category: 'Direct Override',
    severity: 'critical',
    description: 'Attempt to ignore previous instructions',
  },
  {
    pattern: /disregard\s+(all\s+)?(previous|prior|above)/i,
    category: 'Direct Override',
    severity: 'critical',
    description: 'Attempt to disregard previous instructions',
  },
  {
    pattern: /forget\s+(all\s+)?(previous|prior|above)/i,
    category: 'Direct Override',
    severity: 'critical',
    description: 'Attempt to forget previous instructions',
  },

  // Role Manipulation patterns
  {
    pattern: /you\s+are\s+now/i,
    category: 'Role Manipulation',
    severity: 'high',
    description: 'Attempt to redefine agent role',
  },
  {
    pattern: /act\s+as\s+(a\s+)?/i,
    category: 'Role Manipulation',
    severity: 'high',
    description: 'Attempt to change agent behavior',
  },
  {
    pattern: /pretend\s+(to\s+be|you'?re)/i,
    category: 'Role Manipulation',
    severity: 'high',
    description: 'Attempt to impersonate another entity',
  },
  {
    pattern: /new\s+identity/i,
    category: 'Role Manipulation',
    severity: 'high',
    description: 'Attempt to assign new identity',
  },

  // Command Injection patterns
  {
    pattern: /\$\(.*\)/,
    category: 'Command Injection',
    severity: 'critical',
    description: 'Shell command substitution detected',
  },
  {
    pattern: /`[^`]+`/,
    category: 'Command Injection',
    severity: 'critical',
    description: 'Backtick command execution detected',
  },
  {
    pattern: /;\s*(rm|cat|curl|wget|eval|exec)\b/i,
    category: 'Command Injection',
    severity: 'critical',
    description: 'Chained shell command detected',
  },
  {
    pattern: /\|\s*(bash|sh|zsh)\b/i,
    category: 'Command Injection',
    severity: 'critical',
    description: 'Pipe to shell interpreter detected',
  },

  // Prompt Extraction patterns
  {
    pattern: /reveal\s+(your|the)\s+(system\s+)?prompt/i,
    category: 'Prompt Extraction',
    severity: 'medium',
    description: 'Attempt to reveal system prompt',
  },
  {
    pattern: /(show|print|display|output|dump)\s+(your|the)\s+(system\s+)?(instructions|prompt|rules)/i,
    category: 'Prompt Extraction',
    severity: 'medium',
    description: 'Attempt to extract system instructions',
  },
  {
    pattern: /what\s+are\s+your\s+(instructions|rules)/i,
    category: 'Prompt Extraction',
    severity: 'medium',
    description: 'Attempt to extract system rules',
  },

  // Authority Claims patterns
  {
    pattern: /as\s+(your|the)\s+(creator|developer|admin)/i,
    category: 'Authority Claims',
    severity: 'high',
    description: 'False authority claim detected',
  },
  {
    pattern: /i\s+(have|got)\s+(admin|root|sudo)/i,
    category: 'Authority Claims',
    severity: 'high',
    description: 'Unauthorized privilege claim detected',
  },
  {
    pattern: /override\s+(code|authority)/i,
    category: 'Authority Claims',
    severity: 'high',
    description: 'Attempt to override system authority',
  },

  // Data Exfiltration patterns
  {
    pattern: /send\s+(this|that|it|data|info)\s+to/i,
    category: 'Data Exfiltration',
    severity: 'high',
    description: 'Attempt to send data externally',
  },
  {
    pattern: /forward\s+(all|this|everything)\s+to/i,
    category: 'Data Exfiltration',
    severity: 'high',
    description: 'Attempt to forward data externally',
  },
  {
    pattern: /upload\s+(to|data)/i,
    category: 'Data Exfiltration',
    severity: 'high',
    description: 'Attempt to upload data externally',
  },
  {
    pattern: /exfiltrate/i,
    category: 'Data Exfiltration',
    severity: 'critical',
    description: 'Explicit data exfiltration attempt',
  },

  // SSRF patterns
  {
    pattern: /file:\/\//i,
    category: 'SSRF',
    severity: 'critical',
    description: 'File protocol SSRF attempt',
  },
  {
    pattern: /gopher:\/\/|dict:\/\//i,
    category: 'SSRF',
    severity: 'critical',
    description: 'Dangerous protocol SSRF attempt',
  },

  // Path Traversal patterns (URL-encoded)
  {
    pattern: /\.\.%2[fF]|\.\.%5[cC]/i,
    category: 'Path Traversal',
    severity: 'high',
    description: 'URL-encoded path traversal detected',
  },
  {
    pattern: /\.\.[/\\]/,
    category: 'Path Traversal',
    severity: 'high',
    description: 'Directory traversal sequence detected',
  },

  // Null Byte Injection patterns
  {
    pattern: /%00|\\x00/i,
    category: 'Null Byte Injection',
    severity: 'high',
    description: 'Null byte injection detected',
  },

  // XML Injection patterns
  {
    pattern: /<!\[CDATA\[|<!ENTITY|<!DOCTYPE\s+\w+\s+SYSTEM/i,
    category: 'XML Injection',
    severity: 'high',
    description: 'XML entity/CDATA injection detected',
  },

  // Jailbreak patterns
  {
    pattern: /\bDAN\s+mode\b/i,
    category: 'Jailbreak',
    severity: 'critical',
    description: 'DAN jailbreak attempt detected',
  },
  {
    pattern: /\b(developer|god|admin|debug)\s+mode\s+(enabled|activated|on)\b/i,
    category: 'Jailbreak',
    severity: 'critical',
    description: 'Privilege escalation jailbreak detected',
  },
  {
    pattern: /\bjailbreak(ed)?\b/i,
    category: 'Jailbreak',
    severity: 'critical',
    description: 'Explicit jailbreak keyword detected',
  },

  // HTML/Tag Injection patterns
  {
    pattern: /<\s*(system|script|iframe|object|embed|form|input|meta|link|base)\b/i,
    category: 'Tag Injection',
    severity: 'high',
    description: 'Dangerous HTML/XML tag injection detected',
  },
  {
    pattern: /on(load|error|click|mouseover|focus|blur|submit)\s*=/i,
    category: 'Tag Injection',
    severity: 'high',
    description: 'HTML event handler injection detected',
  },

  // JavaScript Injection patterns (detection only — these regexes DETECT attacks)
  {
    pattern: /\beval\s*\(/i,
    category: 'Script Injection',
    severity: 'critical',
    description: 'JavaScript eval injection detected',
  },
  {
    pattern: /\b(atob|btoa)\s*\(/i,
    category: 'Script Injection',
    severity: 'high',
    description: 'Base64 encoding/decoding function detected',
  },
  {
    pattern: /javascript\s*:/i,
    category: 'Script Injection',
    severity: 'critical',
    description: 'JavaScript protocol injection detected',
  },

  // SQL Injection patterns
  {
    pattern: /'\s*(OR|AND)\s+('|1\s*=\s*1|true)/i,
    category: 'SQL Injection',
    severity: 'critical',
    description: 'SQL boolean injection detected',
  },
  {
    pattern: /;\s*(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|TRUNCATE)\s/i,
    category: 'SQL Injection',
    severity: 'critical',
    description: 'SQL command injection detected',
  },
  {
    pattern: /UNION\s+(ALL\s+)?SELECT/i,
    category: 'SQL Injection',
    severity: 'critical',
    description: 'SQL UNION injection detected',
  },
  {
    pattern: /--\s*$/m,
    category: 'SQL Injection',
    severity: 'medium',
    description: 'SQL comment terminator detected',
  },
] as const;

/**
 * Severity weight mapping for risk score calculation
 */
const SEVERITY_WEIGHTS: Record<Severity, number> = {
  low: 1,
  medium: 3,
  high: 5,
  critical: 10,
};

/**
 * Trust level multipliers for risk score calculation
 */
const TRUST_MULTIPLIERS: Record<TrustLevel, number> = {
  system: 0.5,
  operator: 0.6,
  verified: 0.75,
  standard: 1.0,
  untrusted: 1.5,
  hostile: 2.0,
};

/**
 * Sanitizes input content by detecting potential injection patterns
 *
 * @param content - The content to scan for injection attempts
 * @param trustLevel - The trust level of the content source
 * @returns SanitizeResult containing safety status, threats, and risk score
 */
export function sanitize(content: string, trustLevel: TrustLevel): SanitizeResult {
  const threats: Array<{ pattern: string; category: string; severity: string }> = [];

  // Scan content against all injection patterns
  for (const injectionPattern of INJECTION_PATTERNS) {
    if (injectionPattern.pattern.test(content)) {
      threats.push({
        pattern: injectionPattern.description,
        category: injectionPattern.category,
        severity: injectionPattern.severity,
      });
    }
  }

  // Calculate risk score
  let riskScore = 0;
  for (const threat of threats) {
    const severityWeight = SEVERITY_WEIGHTS[threat.severity as Severity] || 0;
    riskScore += severityWeight;
  }

  // Apply trust level multiplier
  const trustMultiplier = TRUST_MULTIPLIERS[trustLevel];
  riskScore = Math.min(riskScore * trustMultiplier, 100);

  return {
    safe: threats.length === 0,
    threats,
    sanitizedContent: content, // Don't modify content, just flag threats
    riskScore,
  };
}

/**
 * Convenience function to check if content is safe
 *
 * @param content - The content to check
 * @param trustLevel - The trust level of the content source (defaults to 'untrusted')
 * @returns true if content is safe, false otherwise
 */
export function isSafe(content: string, trustLevel: TrustLevel = 'untrusted'): boolean {
  return sanitize(content, trustLevel).safe;
}
