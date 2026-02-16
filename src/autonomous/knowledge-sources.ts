/**
 * ARI Knowledge Sources
 *
 * Curated whitelist of verified, authoritative sources for AI knowledge.
 * Each source is carefully selected for:
 * - Official/authoritative status
 * - Technical accuracy
 * - Safety (no user-generated content that could inject prompts)
 * - Relevance to ARI's growth
 *
 * Categories:
 * - OFFICIAL: Direct from creators/maintainers
 * - RESEARCH: Peer-reviewed or established research institutions
 * - DOCUMENTATION: Official technical documentation
 */

export type SourceCategory = 'OFFICIAL' | 'RESEARCH' | 'DOCUMENTATION' | 'NEWS' | 'SOCIAL';
export type SourceTrust = 'verified' | 'standard';

/**
 * Interest domains for relevance scoring
 */
export type InterestDomain =
  | 'ai'              // AI/ML, LLMs, agents
  | 'programming'     // TypeScript, Node.js, web dev
  | 'security'        // Cybersecurity, AppSec
  | 'career'          // Jobs, salary, remote work
  | 'investment'      // Crypto, stocks, Pokemon TCG
  | 'business'        // SaaS, freelancing, startups
  | 'tools'           // Developer tools, productivity
  | 'general';        // Broad tech news

export interface KnowledgeSource {
  id: string;
  name: string;
  url: string;
  category: SourceCategory;
  trust: SourceTrust;
  description: string;
  fetchPath?: string; // Specific path to fetch (for APIs)
  contentType: 'html' | 'json' | 'markdown' | 'rss';
  updateFrequency: 'daily' | 'weekly' | 'monthly';
  enabled: boolean;
  domains?: InterestDomain[]; // What interest domains this source covers
  priority?: number; // 1-10, higher = check first (default 5)
}

/**
 * Verified whitelist of knowledge sources
 *
 * Selection criteria:
 * 1. Must be an official source (company docs, academic institution, established org)
 * 2. No user-generated content (forums, social media, comments)
 * 3. Technical focus - AI, programming, security
 * 4. HTTPS only
 * 5. No paywalls that require credentials
 */
export const KNOWLEDGE_SOURCES: KnowledgeSource[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // ANTHROPIC - Primary source for Claude knowledge
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'anthropic-docs',
    name: 'Anthropic Documentation',
    url: 'https://docs.anthropic.com',
    category: 'OFFICIAL',
    trust: 'verified',
    description: 'Official Claude API documentation from Anthropic',
    contentType: 'html',
    updateFrequency: 'weekly',
    enabled: true,
    domains: ['ai', 'programming'],
    priority: 10,
  },
  {
    id: 'anthropic-news',
    name: 'Anthropic News',
    url: 'https://www.anthropic.com/news',
    category: 'OFFICIAL',
    trust: 'verified',
    description: 'Anthropic blog — model releases, research, company updates',
    contentType: 'html',
    updateFrequency: 'daily',
    enabled: true,
    domains: ['ai', 'business'],
    priority: 10,
  },
  {
    id: 'anthropic-research',
    name: 'Anthropic Research',
    url: 'https://www.anthropic.com/research',
    category: 'OFFICIAL',
    trust: 'verified',
    description: 'Anthropic research publications and findings',
    contentType: 'html',
    updateFrequency: 'weekly',
    enabled: true,
    domains: ['ai', 'security'],
    priority: 9,
  },
  {
    id: 'anthropic-cookbook',
    name: 'Anthropic Cookbook',
    url: 'https://github.com/anthropics/anthropic-cookbook',
    category: 'OFFICIAL',
    trust: 'verified',
    description: 'Official code examples and best practices from Anthropic',
    fetchPath: '/blob/main/README.md',
    contentType: 'markdown',
    updateFrequency: 'weekly',
    enabled: true,
    domains: ['ai', 'programming'],
    priority: 8,
  },
  {
    id: 'anthropic-courses',
    name: 'Anthropic Courses',
    url: 'https://github.com/anthropics/courses',
    category: 'OFFICIAL',
    trust: 'verified',
    description: 'Official educational content from Anthropic',
    contentType: 'markdown',
    updateFrequency: 'monthly',
    enabled: true,
    domains: ['ai', 'programming'],
    priority: 7,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AI RESEARCH - Academic and established research organizations
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'arxiv-cs-ai',
    name: 'arXiv CS.AI',
    url: 'https://arxiv.org/list/cs.AI/recent',
    category: 'RESEARCH',
    trust: 'verified',
    description: 'Peer-reviewed AI research papers (titles/abstracts only)',
    contentType: 'html',
    updateFrequency: 'daily',
    enabled: true,
  },
  {
    id: 'arxiv-cs-cl',
    name: 'arXiv CS.CL',
    url: 'https://arxiv.org/list/cs.CL/recent',
    category: 'RESEARCH',
    trust: 'verified',
    description: 'Computational linguistics and NLP research',
    contentType: 'html',
    updateFrequency: 'daily',
    enabled: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TECHNICAL DOCUMENTATION - Official docs from key technologies
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'nodejs-docs',
    name: 'Node.js Documentation',
    url: 'https://nodejs.org/docs/latest/api/',
    category: 'DOCUMENTATION',
    trust: 'verified',
    description: 'Official Node.js API documentation',
    contentType: 'html',
    updateFrequency: 'monthly',
    enabled: true,
  },
  {
    id: 'typescript-docs',
    name: 'TypeScript Documentation',
    url: 'https://www.typescriptlang.org/docs/',
    category: 'DOCUMENTATION',
    trust: 'verified',
    description: 'Official TypeScript language documentation',
    contentType: 'html',
    updateFrequency: 'monthly',
    enabled: true,
  },
  {
    id: 'mdn-web-docs',
    name: 'MDN Web Docs',
    url: 'https://developer.mozilla.org/en-US/docs/Web',
    category: 'DOCUMENTATION',
    trust: 'verified',
    description: 'Mozilla Developer Network - authoritative web standards reference',
    contentType: 'html',
    updateFrequency: 'weekly',
    enabled: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SECURITY - OWASP and security best practices
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'owasp-top10',
    name: 'OWASP Top 10',
    url: 'https://owasp.org/www-project-top-ten/',
    category: 'DOCUMENTATION',
    trust: 'verified',
    description: 'OWASP security vulnerabilities reference',
    contentType: 'html',
    updateFrequency: 'monthly',
    enabled: true,
  },
  {
    id: 'owasp-llm-top10',
    name: 'OWASP LLM Top 10',
    url: 'https://owasp.org/www-project-top-10-for-large-language-model-applications/',
    category: 'DOCUMENTATION',
    trust: 'verified',
    description: 'OWASP security risks specific to LLM applications',
    contentType: 'html',
    updateFrequency: 'monthly',
    enabled: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AI SAFETY - Alignment and safety research
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'alignment-forum',
    name: 'AI Alignment Forum',
    url: 'https://www.alignmentforum.org/',
    category: 'RESEARCH',
    trust: 'standard',
    description: 'AI safety and alignment research discussions',
    contentType: 'html',
    updateFrequency: 'weekly',
    enabled: false,
    domains: ['ai', 'security'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AI COMPANIES — Competitor and ecosystem intelligence
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'openai-blog',
    name: 'OpenAI Blog',
    url: 'https://openai.com/blog',
    category: 'OFFICIAL',
    trust: 'verified',
    description: 'OpenAI product announcements, research, and model releases',
    contentType: 'html',
    updateFrequency: 'daily',
    enabled: true,
    domains: ['ai', 'business'],
    priority: 9,
  },
  {
    id: 'openai-research',
    name: 'OpenAI Research',
    url: 'https://openai.com/research',
    category: 'RESEARCH',
    trust: 'verified',
    description: 'OpenAI research papers and technical reports',
    contentType: 'html',
    updateFrequency: 'weekly',
    enabled: true,
    domains: ['ai'],
    priority: 7,
  },
  {
    id: 'google-deepmind-blog',
    name: 'Google DeepMind Blog',
    url: 'https://deepmind.google/discover/blog/',
    category: 'OFFICIAL',
    trust: 'verified',
    description: 'Google DeepMind research and product announcements',
    contentType: 'html',
    updateFrequency: 'weekly',
    enabled: true,
    domains: ['ai'],
    priority: 7,
  },
  {
    id: 'xai-blog',
    name: 'xAI Blog',
    url: 'https://x.ai/blog',
    category: 'OFFICIAL',
    trust: 'verified',
    description: 'xAI/Grok announcements and research',
    contentType: 'html',
    updateFrequency: 'weekly',
    enabled: true,
    domains: ['ai', 'business'],
    priority: 7,
  },
  {
    id: 'meta-ai-blog',
    name: 'Meta AI Blog',
    url: 'https://ai.meta.com/blog/',
    category: 'OFFICIAL',
    trust: 'verified',
    description: 'Meta AI (Llama) research and open-source model releases',
    contentType: 'html',
    updateFrequency: 'weekly',
    enabled: true,
    domains: ['ai'],
    priority: 6,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NEWS & AGGREGATORS — Tech news and trending content
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'hackernews-top',
    name: 'Hacker News Top Stories',
    url: 'https://hacker-news.firebaseio.com/v0/topstories.json',
    category: 'NEWS',
    trust: 'standard',
    description: 'Hacker News top stories (IDs) — use /v0/item/{id}.json for details',
    contentType: 'json',
    updateFrequency: 'daily',
    enabled: true,
    domains: ['ai', 'programming', 'business', 'tools'],
    priority: 8,
  },
  {
    id: 'hackernews-best',
    name: 'Hacker News Best Stories',
    url: 'https://hacker-news.firebaseio.com/v0/beststories.json',
    category: 'NEWS',
    trust: 'standard',
    description: 'Hacker News best stories — higher signal than top',
    contentType: 'json',
    updateFrequency: 'daily',
    enabled: true,
    domains: ['ai', 'programming', 'business', 'tools'],
    priority: 7,
  },
  {
    id: 'github-trending',
    name: 'GitHub Trending',
    url: 'https://github.com/trending',
    category: 'NEWS',
    trust: 'verified',
    description: 'GitHub trending repositories — what developers are building',
    contentType: 'html',
    updateFrequency: 'daily',
    enabled: true,
    domains: ['programming', 'tools', 'ai'],
    priority: 7,
  },
  {
    id: 'github-trending-typescript',
    name: 'GitHub Trending TypeScript',
    url: 'https://github.com/trending/typescript',
    category: 'NEWS',
    trust: 'verified',
    description: 'GitHub trending TypeScript repos — directly relevant to ARI',
    contentType: 'html',
    updateFrequency: 'daily',
    enabled: true,
    domains: ['programming', 'tools'],
    priority: 8,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SOCIAL — X/Twitter (requires API token, handled by twitter client)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'x-user-likes',
    name: 'X/Twitter User Likes',
    url: 'https://api.x.com/2/users/:user_id/liked_tweets',
    category: 'SOCIAL',
    trust: 'standard',
    description: 'User liked tweets — signals what Pryce finds interesting',
    contentType: 'json',
    updateFrequency: 'daily',
    enabled: true,
    domains: ['ai', 'business', 'investment', 'general'],
    priority: 9,
  },
  {
    id: 'x-ai-list',
    name: 'X/Twitter AI Leaders',
    url: 'https://api.x.com/2/lists/:list_id/tweets',
    category: 'SOCIAL',
    trust: 'standard',
    description: 'Curated list of AI leaders and researchers on X',
    contentType: 'json',
    updateFrequency: 'daily',
    enabled: true,
    domains: ['ai', 'business'],
    priority: 8,
  },
];

/**
 * Get enabled sources by category
 */
export function getSourcesByCategory(category: SourceCategory): KnowledgeSource[] {
  return KNOWLEDGE_SOURCES.filter(s => s.enabled && s.category === category);
}

/**
 * Get all enabled sources
 */
export function getEnabledSources(): KnowledgeSource[] {
  return KNOWLEDGE_SOURCES.filter(s => s.enabled);
}

/**
 * Get only verified (highest trust) sources
 */
export function getVerifiedSources(): KnowledgeSource[] {
  return KNOWLEDGE_SOURCES.filter(s => s.enabled && s.trust === 'verified');
}

/**
 * Get sources by interest domain, sorted by priority
 */
export function getSourcesByDomain(domain: InterestDomain): KnowledgeSource[] {
  return KNOWLEDGE_SOURCES
    .filter(s => s.enabled && s.domains?.includes(domain))
    .sort((a, b) => (b.priority ?? 5) - (a.priority ?? 5));
}

/**
 * Get daily-update sources (for intelligence scanning), sorted by priority
 */
export function getDailySources(): KnowledgeSource[] {
  return KNOWLEDGE_SOURCES
    .filter(s => s.enabled && s.updateFrequency === 'daily')
    .sort((a, b) => (b.priority ?? 5) - (a.priority ?? 5));
}

/**
 * Get news and social sources (for intelligence scanning)
 */
export function getIntelligenceSources(): KnowledgeSource[] {
  return KNOWLEDGE_SOURCES
    .filter(s => s.enabled && (s.category === 'NEWS' || s.category === 'SOCIAL' || s.updateFrequency === 'daily'))
    .sort((a, b) => (b.priority ?? 5) - (a.priority ?? 5));
}

/**
 * Validate a URL against the whitelist
 */
export function isWhitelistedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return KNOWLEDGE_SOURCES.some(source => {
      const sourceUrl = new URL(source.url);
      return parsed.hostname === sourceUrl.hostname && source.enabled;
    });
  } catch {
    return false;
  }
}
