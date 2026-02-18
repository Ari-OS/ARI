/**
 * ARI Entity Extractor
 *
 * Uses LLM to extract structured entities (people, companies, technologies,
 * locations, concepts, dates) from text content. Provides a simple
 * prompt-based extraction approach.
 *
 * Layer: L2 (System) — imports from kernel only
 */

import { createLogger } from '../kernel/logger.js';

const log = createLogger('entity-extractor');

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExtractedEntities {
  people: string[];
  companies: string[];
  technologies: string[];
  locations: string[];
  concepts: string[];
  dates: string[];
}

interface Orchestrator {
  query(prompt: string, agent?: string): Promise<string>;
}

// ─── Extraction prompt ───────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `Extract entities from the following text. Return ONLY valid JSON with these keys:
- people: array of person names
- companies: array of company/organization names
- technologies: array of technology/tool/framework names
- locations: array of place names (cities, countries, regions)
- concepts: array of abstract concepts, topics, or domains
- dates: array of date references (formatted as strings)

If a category has no entities, use an empty array.
Do not include duplicates within a category.
Limit each category to at most 15 entries.

Text:
`;

const MAX_TEXT_LENGTH = 8000;

// ═══════════════════════════════════════════════════════════════════════════════
// ENTITY EXTRACTOR
// ═══════════════════════════════════════════════════════════════════════════════

export class EntityExtractor {
  private readonly orchestrator: Orchestrator;

  constructor(orchestrator: Orchestrator) {
    this.orchestrator = orchestrator;
  }

  /**
   * Extract entities from text using LLM.
   * Truncates long text to avoid excessive token usage.
   */
  async extract(text: string): Promise<ExtractedEntities> {
    if (!text || text.trim().length === 0) {
      return emptyEntities();
    }

    const truncated = text.slice(0, MAX_TEXT_LENGTH);
    const prompt = EXTRACTION_PROMPT + truncated;

    log.info({ textLength: text.length, truncated: text.length > MAX_TEXT_LENGTH }, 'Extracting entities');

    try {
      const response = await this.orchestrator.query(prompt, 'entity-extractor');
      return this.parseResponse(response);
    } catch (err) {
      log.error({ error: String(err) }, 'Entity extraction failed, returning empty');
      return emptyEntities();
    }
  }

  // ── Parse LLM response ────────────────────────────────────────────────────

  private parseResponse(response: string): ExtractedEntities {
    // Try to extract JSON from the response (LLM may include markdown fences)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      log.warn('No JSON found in LLM response');
      return emptyEntities();
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      return {
        people: toStringArray(parsed.people),
        companies: toStringArray(parsed.companies),
        technologies: toStringArray(parsed.technologies),
        locations: toStringArray(parsed.locations),
        concepts: toStringArray(parsed.concepts),
        dates: toStringArray(parsed.dates),
      };
    } catch (err) {
      log.warn({ error: String(err) }, 'Failed to parse entity JSON');
      return emptyEntities();
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emptyEntities(): ExtractedEntities {
  return {
    people: [],
    companies: [],
    technologies: [],
    locations: [],
    concepts: [],
    dates: [],
  };
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string')
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 15);
}
