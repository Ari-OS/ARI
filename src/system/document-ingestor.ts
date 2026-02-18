import { createLogger } from '../kernel/logger.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const log = createLogger('document-ingestor');

export interface IngestedDocument {
  id: string;
  source: string;
  category: string;
  content: string;
  ingestedAt: string;
  wordCount: number;
}

export class DocumentIngestor {
  private documents: Map<string, IngestedDocument> = new Map();
  private persistPath: string;

  constructor(private dataDir: string) {
    this.persistPath = path.join(dataDir, 'ingested-documents.json');
  }

  async init(): Promise<void> {
    // Create data dir if needed
    await fs.mkdir(this.dataDir, { recursive: true });
    // Load persisted documents
    try {
      const data = await fs.readFile(this.persistPath, 'utf-8');
      const parsed = JSON.parse(data) as Record<string, IngestedDocument>;
      for (const [key, value] of Object.entries(parsed)) {
        this.documents.set(key, value);
      }
      log.info({ count: this.documents.size }, 'Loaded ingested documents');
    } catch {
      log.info('No persisted documents, starting fresh');
    }
  }

  async ingestText(content: string, source: string, category: string): Promise<IngestedDocument> {
    const id = `${category}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const doc: IngestedDocument = {
      id,
      source,
      category,
      content: content.slice(0, 50000), // Cap at 50K chars
      ingestedAt: new Date().toISOString(),
      wordCount: content.split(/\s+/).length,
    };
    this.documents.set(id, doc);
    await this.save();
    log.info({ id, source, category, wordCount: doc.wordCount }, 'Document ingested');
    return doc;
  }

  async ingestBriefing(briefingHtml: string, date: string): Promise<IngestedDocument> {
    // Strip HTML tags for plain text storage
    const plainText = briefingHtml.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').trim();
    return this.ingestText(plainText, `briefing-${date}`, 'briefing');
  }

  async ingestConversation(messages: Array<{ role: string; content: string }>, sessionId: string): Promise<IngestedDocument> {
    const content = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    return this.ingestText(content, `conversation-${sessionId}`, 'conversation');
  }

  search(query: string, limit: number = 10): IngestedDocument[] {
    // Simple text search across ingested documents
    const lower = query.toLowerCase();
    const results: Array<{ doc: IngestedDocument; score: number }> = [];

    for (const doc of this.documents.values()) {
      const content = doc.content.toLowerCase();
      const words = lower.split(/\s+/);
      let score = 0;
      for (const word of words) {
        if (content.includes(word)) score++;
      }
      if (score > 0) {
        results.push({ doc, score });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(r => r.doc);
  }

  getDocumentCount(): number {
    return this.documents.size;
  }

  getDocumentsByCategory(category: string): IngestedDocument[] {
    return Array.from(this.documents.values()).filter(d => d.category === category);
  }

  private async save(): Promise<void> {
    const obj: Record<string, IngestedDocument> = {};
    for (const [key, value] of this.documents) {
      obj[key] = value;
    }
    await fs.writeFile(this.persistPath, JSON.stringify(obj, null, 2));
  }
}
