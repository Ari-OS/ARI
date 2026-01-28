---
name: ari-natural-language
description: Natural language understanding and intent parsing for ARI
triggers:
  - "understand intent"
  - "parse request"
  - "natural language"
  - "user intent"
---

# ARI Natural Language Understanding

## Purpose

Parse user intents from natural language to structured task specifications for the Planner agent.

## Intent Structure

```typescript
interface ParsedIntent {
  action: string;           // Primary action verb
  target: string;           // What to act on
  parameters: Record<string, unknown>;  // Extracted parameters
  context: {
    domain: string;         // Life domain (health, career, etc.)
    urgency: 'low' | 'normal' | 'high' | 'critical';
    confidence: number;     // 0-1 confidence score
  };
  originalText: string;
}
```

## Intent Parsing

```typescript
// In Router or dedicated NLU component
function parseIntent(message: string): ParsedIntent {
  // Extract action verb
  const action = extractAction(message);

  // Extract target
  const target = extractTarget(message, action);

  // Extract parameters
  const parameters = extractParameters(message);

  // Determine domain
  const domain = classifyDomain(message);

  // Assess urgency
  const urgency = assessUrgency(message);

  return {
    action,
    target,
    parameters,
    context: {
      domain,
      urgency,
      confidence: calculateConfidence(action, target, parameters)
    },
    originalText: message
  };
}
```

## Action Recognition

```typescript
const ACTION_PATTERNS: Record<string, RegExp[]> = {
  create: [
    /\b(create|make|build|generate|add|new)\b/i
  ],
  read: [
    /\b(read|show|display|get|fetch|find|search|look|check)\b/i
  ],
  update: [
    /\b(update|edit|modify|change|set|configure)\b/i
  ],
  delete: [
    /\b(delete|remove|clear|reset|destroy)\b/i
  ],
  analyze: [
    /\b(analyze|review|audit|assess|evaluate|examine)\b/i
  ],
  plan: [
    /\b(plan|schedule|organize|prioritize)\b/i
  ],
  execute: [
    /\b(run|execute|start|begin|do|perform)\b/i
  ]
};

function extractAction(text: string): string {
  for (const [action, patterns] of Object.entries(ACTION_PATTERNS)) {
    if (patterns.some(p => p.test(text))) {
      return action;
    }
  }
  return 'unknown';
}
```

## Domain Classification

```typescript
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  health: ['health', 'exercise', 'workout', 'diet', 'sleep', 'medical', 'fitness'],
  career: ['work', 'job', 'career', 'meeting', 'project', 'deadline', 'client'],
  finance: ['money', 'budget', 'expense', 'income', 'investment', 'payment'],
  family: ['family', 'kids', 'spouse', 'parent', 'home'],
  learning: ['learn', 'study', 'course', 'skill', 'book', 'tutorial'],
  systems: ['server', 'code', 'deploy', 'backup', 'database', 'api'],
  ventures: ['business', 'startup', 'venture', 'client', 'revenue']
};

function classifyDomain(text: string): string {
  const lowerText = text.toLowerCase();
  let bestMatch = 'general';
  let bestScore = 0;

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    const score = keywords.filter(k => lowerText.includes(k)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = domain;
    }
  }

  return bestMatch;
}
```

## Parameter Extraction

```typescript
function extractParameters(text: string): Record<string, unknown> {
  const params: Record<string, unknown> = {};

  // Extract file paths
  const pathMatch = text.match(/(?:file|path)\s+([^\s]+)/i);
  if (pathMatch) params.path = pathMatch[1];

  // Extract dates/times
  const dateMatch = text.match(/(?:on|by|at|before|after)\s+(\d{4}-\d{2}-\d{2}|\w+day|tomorrow|today)/i);
  if (dateMatch) params.date = parseDate(dateMatch[1]);

  // Extract quantities
  const numMatch = text.match(/(\d+)\s+(files?|items?|tasks?)/i);
  if (numMatch) params.count = parseInt(numMatch[1]);

  // Extract named entities
  const entities = extractEntities(text);
  if (entities.length) params.entities = entities;

  return params;
}
```

## Urgency Assessment

```typescript
const URGENCY_INDICATORS = {
  critical: ['urgent', 'emergency', 'critical', 'asap', 'immediately', 'now'],
  high: ['important', 'priority', 'soon', 'quickly', 'today'],
  low: ['sometime', 'eventually', 'when you can', 'no rush', 'later']
};

function assessUrgency(text: string): 'low' | 'normal' | 'high' | 'critical' {
  const lowerText = text.toLowerCase();

  if (URGENCY_INDICATORS.critical.some(w => lowerText.includes(w))) {
    return 'critical';
  }
  if (URGENCY_INDICATORS.high.some(w => lowerText.includes(w))) {
    return 'high';
  }
  if (URGENCY_INDICATORS.low.some(w => lowerText.includes(w))) {
    return 'low';
  }
  return 'normal';
}
```

## Confidence Scoring

```typescript
function calculateConfidence(
  action: string,
  target: string,
  parameters: Record<string, unknown>
): number {
  let confidence = 0.5; // Base confidence

  // Boost for recognized action
  if (action !== 'unknown') confidence += 0.2;

  // Boost for clear target
  if (target && target !== 'unknown') confidence += 0.15;

  // Boost for extracted parameters
  confidence += Math.min(Object.keys(parameters).length * 0.05, 0.15);

  return Math.min(confidence, 1.0);
}
```

## Intent to Task

```typescript
// Convert parsed intent to task for Planner
function intentToTask(intent: ParsedIntent): Task {
  return {
    id: uuid(),
    description: intent.originalText,
    action: intent.action,
    target: intent.target,
    parameters: intent.parameters,
    priority: urgencyToPriority(intent.context.urgency),
    domain: intent.context.domain,
    confidence: intent.context.confidence
  };
}
```
