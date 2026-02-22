import fs from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('playbook-manager');

export interface Playbook {
  id: string;
  domain: string;
  content: string;
}

/**
 * PlaybookManager
 * 
 * Manages evolving "Playbooks" for different domains (e.g. Code Refactoring, Scheduling).
 * Playbooks are injected into agent contexts to prevent repeating past mistakes.
 */
export class PlaybookManager {
  private readonly dir = path.join(homedir(), '.ari', 'playbooks');

  async initialize(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
  }

  /**
   * Retrieve a playbook by domain name
   */
  async getPlaybook(domain: string): Promise<Playbook | null> {
    const safeDomain = domain.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
    const playbookPath = path.join(this.dir, `${safeDomain}.md`);

    try {
      const content = await fs.readFile(playbookPath, 'utf-8');
      return { id: safeDomain, domain, content };
    } catch {
      return null;
    }
  }

  /**
   * Append an insight to a playbook
   */
  async appendInsight(domain: string, insight: string): Promise<void> {
    const safeDomain = domain.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
    const playbookPath = path.join(this.dir, `${safeDomain}.md`);

    const entry = `\n## Insight [${new Date().toISOString()}]\n${insight}\n`;
    
    try {
      await fs.access(playbookPath);
      await fs.appendFile(playbookPath, entry);
    } catch {
      // Create new playbook if it doesn't exist
      const initialContent = `# Playbook: ${domain}\n\nThis playbook contains evolved strategies and constraints for ${domain}.\n${entry}`;
      await fs.writeFile(playbookPath, initialContent);
    }
    
    log.info({ domain }, 'Appended insight to playbook');
  }

  /**
   * Get context string for injecting into system prompts
   */
  async getContextString(domain: string): Promise<string> {
    const playbook = await this.getPlaybook(domain);
    if (!playbook) {
      return '';
    }
    return `\n\n=== RELEVANT PLAYBOOK: ${domain} ===\n${playbook.content}\n====================================\n\n`;
  }
}

// Singleton instance
let playbookManagerInstance: PlaybookManager | null = null;
export function getPlaybookManager(): PlaybookManager {
  if (!playbookManagerInstance) {
    playbookManagerInstance = new PlaybookManager();
  }
  return playbookManagerInstance;
}
