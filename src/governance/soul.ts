import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentId } from '../kernel/types.js';

/**
 * Voting behavior style
 */
export type VotingStyle = 'cautious' | 'balanced' | 'progressive';

/**
 * SOUL identity for an agent
 */
export interface SOULIdentity {
  agentId: AgentId;
  name: string;
  role: string;
  pillar: string;
  personality: string;
  values: string[];
  communicationStyle: string;
  decisionPatterns: string[];
  cares: string[];
  refuses: string[];
  votingBehavior: {
    style: VotingStyle;
    vetoAuthority: string[];
    defaultPosition: string;
    approvalCondition: string;
  };
}

/**
 * Decision context for SOUL influence
 */
export interface DecisionContext {
  action: string;
  confidence: number;
  alternatives: string[];
}

/**
 * Result of SOUL influence on a decision
 */
export interface InfluencedDecision {
  action: string;
  confidence: number;
  reasoning: string;
}

/**
 * SOULManager - Persistent agent identity system
 * 
 * Based on Mission Control / Fleet Command patterns:
 * - SOUL files define personality, values, and decision patterns
 * - Personalities influence voting and decision-making
 * - Each agent has a distinct identity that persists across sessions
 */
export class SOULManager {
  private souls = new Map<AgentId, SOULIdentity>();
  private readonly soulsPath: string;

  constructor(soulsPath: string = '.claude/souls') {
    this.soulsPath = soulsPath;
  }

  /**
   * Load all SOUL files from the souls directory
   */
  async loadSouls(): Promise<void> {
    try {
      const files = await fs.readdir(this.soulsPath);
      const mdFiles = files.filter(f => f.endsWith('.md'));

      for (const file of mdFiles) {
        try {
          const content = await fs.readFile(path.join(this.soulsPath, file), 'utf-8');
          const soul = this.parseSoulFile(content, file);
          if (soul) {
            this.souls.set(soul.agentId, soul);
          }
        } catch (error) {
          console.error(`Failed to load SOUL file ${file}:`, error);
        }
      }

      console.log(`[SOULManager] Loaded ${this.souls.size} SOUL identities`);
    } catch {
      // Souls directory may not exist yet
      console.log('[SOULManager] Souls directory not found, using defaults');
    }
  }

  /**
   * Parse a SOUL markdown file into structured identity
   */
  private parseSoulFile(content: string, filename: string): SOULIdentity | null {
    const lines = content.split('\n');
    const soul: Partial<SOULIdentity> = {
      values: [],
      decisionPatterns: [],
      cares: [],
      refuses: [],
      votingBehavior: {
        style: 'balanced',
        vetoAuthority: [],
        defaultPosition: 'neutral',
        approvalCondition: 'clear analysis provided',
      },
    };

    let currentSection = '';
    let currentList: string[] = [];
    let inListSection = false;

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('# SOUL:')) {
        soul.name = trimmedLine.replace('# SOUL:', '').trim();
      } else if (trimmedLine.startsWith('## ')) {
        // Save previous list if we were in a list section
        if (inListSection && currentList.length > 0) {
          this.assignList(soul, currentSection, currentList);
          currentList = [];
        }
        currentSection = trimmedLine.replace('## ', '').trim().toLowerCase();
        inListSection = false;
      } else if (trimmedLine.startsWith('**') && trimmedLine.includes(':')) {
        // Match **Key:** Value pattern where colon is inside the bold markers
        const match = trimmedLine.match(/\*\*([^:]+):\*\*\s*(.*)/);
        if (match) {
          this.assignField(soul, match[1].trim().toLowerCase(), match[2].trim());
        }
      } else if (trimmedLine.startsWith('- ') || /^\d+\.\s/.test(trimmedLine)) {
        inListSection = true;
        const listItem = trimmedLine.replace(/^[-\d.]\s+/, '').trim();
        if (listItem) {
          currentList.push(listItem);
        }
      }
    }

    // Assign final list
    if (inListSection && currentList.length > 0) {
      this.assignList(soul, currentSection, currentList);
    }

    // Map filename to agentId - All 15 Council Members
    const agentMap: Record<string, AgentId> = {
      // Pillar 1: Infrastructure
      'ATLAS.md': 'router',
      'BOLT.md': 'executor',
      'ECHO.md': 'memory_keeper',
      // Pillar 2: Protection
      'AEGIS.md': 'guardian',
      'SCOUT.md': 'risk_assessor',
      // Pillar 3: Strategy
      'TRUE.md': 'planner',
      'TEMPO.md': 'scheduler',
      'OPAL.md': 'resource_manager',
      // Pillar 4: Life Domains
      'PULSE.md': 'wellness',
      'EMBER.md': 'relationships',
      'PRISM.md': 'creative',
      'MINT.md': 'wealth',
      'BLOOM.md': 'growth',
      // Pillar 5: Meta
      'VERA.md': 'ethics',
      'NEXUS.md': 'integrator',
    };

    soul.agentId = agentMap[filename];

    // Validate required fields
    if (soul.agentId && soul.name) {
      return soul as SOULIdentity;
    }

    return null;
  }

  /**
   * Assign a field value from SOUL file
   */
  private assignField(soul: Partial<SOULIdentity>, key: string, value: string): void {
    switch (key) {
      case 'name':
        soul.name = value;
        break;
      case 'role':
        soul.role = value;
        break;
      case 'pillar':
        soul.pillar = value;
        break;
      case 'council position':
        // Used for context, not directly assigned
        break;
      case 'style':
        if (soul.votingBehavior) {
          soul.votingBehavior.style = value.toLowerCase() as VotingStyle;
        }
        break;
      case 'veto authority':
        if (soul.votingBehavior) {
          soul.votingBehavior.vetoAuthority = value.split(',').map(s => s.trim());
        }
        break;
      case 'default position':
        if (soul.votingBehavior) {
          soul.votingBehavior.defaultPosition = value;
        }
        break;
      case 'approval condition':
        if (soul.votingBehavior) {
          soul.votingBehavior.approvalCondition = value;
        }
        break;
    }
  }

  /**
   * Assign a list to the appropriate field
   */
  private assignList(soul: Partial<SOULIdentity>, section: string, list: string[]): void {
    switch (section) {
      case 'core values':
        soul.values = list;
        break;
      case 'decision patterns':
        soul.decisionPatterns = list;
        break;
      case 'what i care about':
        soul.cares = list;
        break;
      case 'what i refuse to do':
        soul.refuses = list;
        break;
      case 'personality':
        soul.personality = list.join(' ');
        break;
      case 'communication style':
        soul.communicationStyle = list.join(' ');
        break;
    }
  }

  /**
   * Get identity for an agent
   */
  getIdentity(agentId: AgentId): SOULIdentity | undefined {
    return this.souls.get(agentId);
  }

  /**
   * Get all loaded identities
   */
  getAllIdentities(): SOULIdentity[] {
    return Array.from(this.souls.values());
  }

  /**
   * Check if an agent has a SOUL identity loaded
   */
  hasIdentity(agentId: AgentId): boolean {
    return this.souls.has(agentId);
  }

  /**
   * Apply SOUL personality to a decision
   */
  influenceDecision(agentId: AgentId, decision: DecisionContext): InfluencedDecision {
    const soul = this.souls.get(agentId);
    if (!soul) {
      return { ...decision, reasoning: 'No SOUL identity loaded' };
    }

    let reasoning = `${soul.name} (${soul.role}): `;

    // Check against "refuses" list
    for (const refuse of soul.refuses) {
      const refuseKeywords = refuse.toLowerCase().split(/\s+/).slice(0, 3);
      const actionLower = decision.action.toLowerCase();
      
      if (refuseKeywords.some(kw => actionLower.includes(kw))) {
        return {
          action: 'BLOCK',
          confidence: 1,
          reasoning: `${reasoning}Refuses to "${refuse}"`,
        };
      }
    }

    // Apply decision patterns
    for (const pattern of soul.decisionPatterns) {
      if (pattern.toLowerCase().includes('default to blocking when uncertain')) {
        if (decision.confidence < 0.7) {
          return {
            action: 'BLOCK',
            confidence: 0.9,
            reasoning: `${reasoning}Blocking due to uncertainty (confidence ${decision.confidence.toFixed(2)})`,
          };
        }
      }

      if (pattern.toLowerCase().includes('escalate') && decision.confidence < 0.5) {
        return {
          action: 'ESCALATE',
          confidence: 0.8,
          reasoning: `${reasoning}Escalating due to low confidence (${decision.confidence.toFixed(2)})`,
        };
      }
    }

    // Apply voting style
    if (soul.votingBehavior.style === 'cautious' && decision.confidence < 0.8) {
      return {
        ...decision,
        confidence: decision.confidence * 0.9,
        reasoning: `${reasoning}Cautious style applied - reduced confidence`,
      };
    }

    if (soul.votingBehavior.style === 'progressive' && decision.confidence > 0.6) {
      return {
        ...decision,
        confidence: Math.min(1, decision.confidence * 1.1),
        reasoning: `${reasoning}Progressive style applied - boosted confidence`,
      };
    }

    reasoning += `Approved based on ${soul.votingBehavior.style} voting style`;

    return { ...decision, reasoning };
  }

  /**
   * Get voting recommendation from agent's SOUL
   */
  getVotingRecommendation(agentId: AgentId, proposal: {
    topic: string;
    risk: 'low' | 'medium' | 'high' | 'critical';
    domains: string[];
  }): {
    recommendation: 'approve' | 'reject' | 'abstain';
    confidence: number;
    reasoning: string;
  } {
    const soul = this.souls.get(agentId);
    if (!soul) {
      return {
        recommendation: 'abstain',
        confidence: 0.5,
        reasoning: 'No SOUL identity loaded',
      };
    }

    // Check veto authority
    const hasVetoAuthority = proposal.domains.some(
      d => soul.votingBehavior.vetoAuthority.includes(d)
    );

    // Check against cares
    const caresAboutTopic = soul.cares.some(care =>
      proposal.topic.toLowerCase().includes(care.toLowerCase().split(' ')[0])
    );

    // Determine recommendation based on style and risk
    let recommendation: 'approve' | 'reject' | 'abstain' = 'abstain';
    let confidence = 0.5;
    let reasoning = `${soul.name}: `;

    if (hasVetoAuthority && proposal.risk === 'critical') {
      recommendation = 'reject';
      confidence = 0.95;
      reasoning += `Veto authority invoked for critical risk in ${proposal.domains.join(', ')}`;
    } else if (soul.votingBehavior.style === 'cautious' && proposal.risk !== 'low') {
      recommendation = proposal.risk === 'critical' ? 'reject' : 'abstain';
      confidence = 0.7;
      reasoning += `Cautious approach to ${proposal.risk} risk proposal`;
    } else if (soul.votingBehavior.style === 'progressive' && proposal.risk !== 'critical') {
      recommendation = 'approve';
      confidence = 0.75;
      reasoning += `Progressive support for non-critical change`;
    } else if (caresAboutTopic) {
      recommendation = proposal.risk === 'low' ? 'approve' : 'abstain';
      confidence = 0.8;
      reasoning += `Domain expertise applied`;
    } else {
      recommendation = 'abstain';
      confidence = 0.5;
      reasoning += soul.votingBehavior.defaultPosition;
    }

    return { recommendation, confidence, reasoning };
  }

  /**
   * Register a SOUL identity programmatically
   */
  registerIdentity(soul: SOULIdentity): void {
    this.souls.set(soul.agentId, soul);
  }

  /**
   * Get statistics about loaded SOULs
   */
  getStats(): {
    totalLoaded: number;
    byPillar: Record<string, number>;
    byVotingStyle: Record<VotingStyle, number>;
  } {
    const souls = Array.from(this.souls.values());
    const byPillar: Record<string, number> = {};
    const byVotingStyle: Record<VotingStyle, number> = {
      cautious: 0,
      balanced: 0,
      progressive: 0,
    };

    for (const soul of souls) {
      byPillar[soul.pillar] = (byPillar[soul.pillar] || 0) + 1;
      byVotingStyle[soul.votingBehavior.style]++;
    }

    return {
      totalLoaded: souls.length,
      byPillar,
      byVotingStyle,
    };
  }
}
