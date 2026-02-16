/**
 * ARI Career Tracker
 *
 * Tracks job opportunities matching Pryce's profile and generates career reports.
 * Uses skill-based matching, salary alignment, and location preferences.
 *
 * Features:
 * - Profile-based opportunity scoring
 * - Multi-factor match calculation (skills, salary, location)
 * - Daily opportunity reports
 * - EventBus integration for real-time notifications
 *
 * Layer: L5 (Autonomous Operations)
 */

import type { EventBus } from '../kernel/event-bus.js';
import { createLogger } from '../kernel/logger.js';

const log = createLogger('career-tracker');

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A job opportunity from external sources.
 */
export interface JobOpportunity {
  id: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  salary?: { min: number; max: number };
  skills: string[];
  description: string;
  source: string;
  sourceUrl: string;
  postedAt: string;
}

/**
 * A scored match between an opportunity and the target profile.
 */
export interface CareerMatch {
  opportunity: JobOpportunity;
  matchScore: number;
  skillMatch: number;
  salaryMatch: number;
  locationMatch: number;
  reasoning: string[];
}

/**
 * Target career profile for matching.
 */
export interface TargetProfile {
  targetRoles: string[];
  targetSalary: { min: number; max: number };
  preferRemote: boolean;
  skills: string[];
  locations: string[];
}

/**
 * Simulated job board source.
 */
interface JobSource {
  name: string;
  baseUrl: string;
  enabled: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_PROFILE: TargetProfile = {
  targetRoles: ['Software Engineer', 'Senior Software Engineer', 'Tech Lead'],
  targetSalary: { min: 150000, max: 300000 },
  preferRemote: true,
  skills: ['TypeScript', 'Node.js', 'React', 'Python', 'AWS', 'PostgreSQL'],
  locations: ['Remote', 'San Francisco', 'New York', 'Seattle'],
};

const JOB_SOURCES: JobSource[] = [
  { name: 'LinkedIn', baseUrl: 'https://linkedin.com/jobs', enabled: true },
  { name: 'Indeed', baseUrl: 'https://indeed.com', enabled: true },
  { name: 'Glassdoor', baseUrl: 'https://glassdoor.com/jobs', enabled: true },
  { name: 'Wellfound', baseUrl: 'https://wellfound.com/jobs', enabled: true },
];

// ═══════════════════════════════════════════════════════════════════════════
// SCORING WEIGHTS
// ═══════════════════════════════════════════════════════════════════════════

const WEIGHTS = {
  skill: 0.45,      // Skills are most important
  salary: 0.30,     // Salary alignment
  location: 0.25,   // Location/remote preference
};

const MIN_MATCH_SCORE = 0.4; // Minimum score to include in results

// ═══════════════════════════════════════════════════════════════════════════
// CAREER TRACKER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tracks and scores career opportunities against a target profile.
 */
export class CareerTracker {
  private eventBus: EventBus | null;
  private profile: TargetProfile;
  private cachedMatches: CareerMatch[] = [];
  private lastScanAt: string | null = null;

  constructor(eventBus?: EventBus) {
    this.eventBus = eventBus ?? null;
    this.profile = { ...DEFAULT_PROFILE };

    log.info('CareerTracker initialized');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PROFILE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Set the target profile for matching.
   */
  setTargetProfile(profile: Partial<TargetProfile>): void {
    this.profile = {
      ...this.profile,
      ...profile,
    };

    log.info(
      { roles: this.profile.targetRoles.length, skills: this.profile.skills.length },
      'Profile updated'
    );
  }

  /**
   * Get the current target profile.
   */
  getTargetProfile(): TargetProfile {
    return { ...this.profile };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // OPPORTUNITY SCANNING
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Scan all job sources for opportunities.
   * Currently simulated; will integrate with real APIs later.
   */
  async scanOpportunities(): Promise<CareerMatch[]> {
    log.info('Starting opportunity scan');

    const opportunities: JobOpportunity[] = [];

    // Fetch from each enabled source (simulated for now)
    for (const source of JOB_SOURCES) {
      if (source.enabled) {
        const sourceOpportunities = await this.fetchFromSource(source);
        opportunities.push(...sourceOpportunities);
      }
    }

    // Score each opportunity
    const matches = opportunities
      .map(opp => this.scoreOpportunity(opp))
      .filter(match => match.matchScore >= MIN_MATCH_SCORE)
      .sort((a, b) => b.matchScore - a.matchScore);

    // Cache results
    this.cachedMatches = matches;
    this.lastScanAt = new Date().toISOString();

    // Emit event if we have matches
    if (matches.length > 0 && this.eventBus) {
      this.eventBus.emit('career:new_matches', {
        count: matches.length,
        topMatch: matches[0].opportunity.title,
      });
    }

    log.info(
      { totalOpportunities: opportunities.length, matchCount: matches.length },
      'Scan complete'
    );

    return matches;
  }

  /**
   * Fetch opportunities from a job source.
   * Simulated for now - returns mock data based on profile.
   */
  private async fetchFromSource(source: JobSource): Promise<JobOpportunity[]> {
    // Simulate API call delay
    await this.sleep(100);

    // Generate mock opportunities based on profile
    return this.generateMockOpportunities(source);
  }

  /**
   * Generate realistic mock opportunities for testing.
   */
  private generateMockOpportunities(source: JobSource): JobOpportunity[] {
    const companies = [
      'Anthropic', 'OpenAI', 'Stripe', 'Vercel', 'Databricks',
      'Figma', 'Linear', 'Notion', 'Supabase', 'Planetscale',
    ];

    const skillSets = [
      ['TypeScript', 'Node.js', 'React', 'PostgreSQL'],
      ['Python', 'AWS', 'Kubernetes', 'Terraform'],
      ['Go', 'gRPC', 'Redis', 'MongoDB'],
      ['TypeScript', 'AWS', 'GraphQL', 'DynamoDB'],
      ['Python', 'PyTorch', 'CUDA', 'Docker'],
    ];

    const locations = ['Remote', 'San Francisco, CA', 'New York, NY', 'Seattle, WA', 'Austin, TX'];

    const opportunities: JobOpportunity[] = [];
    const count = Math.floor(Math.random() * 3) + 2; // 2-4 opportunities per source

    for (let i = 0; i < count; i++) {
      const company = companies[Math.floor(Math.random() * companies.length)];
      const roleIndex = Math.floor(Math.random() * this.profile.targetRoles.length);
      const role = this.profile.targetRoles[roleIndex] ?? 'Software Engineer';
      const skills = skillSets[Math.floor(Math.random() * skillSets.length)];
      const location = locations[Math.floor(Math.random() * locations.length)];
      const isRemote = location === 'Remote' || Math.random() > 0.7;

      // Generate salary based on role and randomization
      const baseSalary = this.profile.targetSalary.min;
      const salaryRange = this.profile.targetSalary.max - baseSalary;
      const salaryMin = baseSalary + Math.floor(Math.random() * (salaryRange * 0.3));
      const salaryMax = salaryMin + Math.floor(Math.random() * (salaryRange * 0.5)) + 20000;

      opportunities.push({
        id: `${source.name.toLowerCase()}-${Date.now()}-${i}`,
        title: role,
        company,
        location,
        remote: isRemote,
        salary: { min: salaryMin, max: salaryMax },
        skills: skills,
        description: `${company} is looking for a ${role} to join our team. ${isRemote ? 'This is a remote position.' : ''}`,
        source: source.name,
        sourceUrl: `${source.baseUrl}/${company.toLowerCase()}-${role.toLowerCase().replace(/\s+/g, '-')}`,
        postedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    return opportunities;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SCORING LOGIC
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Score an opportunity against the target profile.
   */
  scoreOpportunity(opportunity: JobOpportunity): CareerMatch {
    const reasoning: string[] = [];

    // Calculate individual scores
    const skillMatch = this.calculateSkillMatch(opportunity, reasoning);
    const salaryMatch = this.calculateSalaryMatch(opportunity, reasoning);
    const locationMatch = this.calculateLocationMatch(opportunity, reasoning);

    // Calculate weighted overall score
    const matchScore =
      skillMatch * WEIGHTS.skill +
      salaryMatch * WEIGHTS.salary +
      locationMatch * WEIGHTS.location;

    return {
      opportunity,
      matchScore: Math.round(matchScore * 100) / 100,
      skillMatch: Math.round(skillMatch * 100) / 100,
      salaryMatch: Math.round(salaryMatch * 100) / 100,
      locationMatch: Math.round(locationMatch * 100) / 100,
      reasoning,
    };
  }

  /**
   * Calculate skill match score (0-1).
   */
  private calculateSkillMatch(opportunity: JobOpportunity, reasoning: string[]): number {
    const profileSkills = this.profile.skills.map(s => s.toLowerCase());
    const jobSkills = opportunity.skills.map(s => s.toLowerCase());

    if (jobSkills.length === 0) {
      reasoning.push('No skills listed');
      return 0.5; // Neutral score if no skills listed
    }

    // Count matching skills
    const matchingSkills = jobSkills.filter(skill =>
      profileSkills.some(ps => ps === skill || ps.includes(skill) || skill.includes(ps))
    );

    const matchRatio = matchingSkills.length / Math.max(jobSkills.length, 1);

    if (matchRatio >= 0.8) {
      reasoning.push(`Strong skill match: ${matchingSkills.length}/${jobSkills.length} skills`);
    } else if (matchRatio >= 0.5) {
      reasoning.push(`Moderate skill match: ${matchingSkills.length}/${jobSkills.length} skills`);
    } else {
      reasoning.push(`Limited skill overlap: ${matchingSkills.length}/${jobSkills.length} skills`);
    }

    return matchRatio;
  }

  /**
   * Calculate salary match score (0-1).
   */
  private calculateSalaryMatch(opportunity: JobOpportunity, reasoning: string[]): number {
    if (!opportunity.salary) {
      reasoning.push('Salary not disclosed');
      return 0.5; // Neutral score if no salary listed
    }

    const { min: oppMin, max: oppMax } = opportunity.salary;
    const { min: targetMin, max: targetMax } = this.profile.targetSalary;

    // Check if ranges overlap
    const overlapStart = Math.max(oppMin, targetMin);
    const overlapEnd = Math.min(oppMax, targetMax);

    if (overlapEnd < overlapStart) {
      // No overlap
      if (oppMax < targetMin) {
        const gap = ((targetMin - oppMax) / targetMin) * 100;
        reasoning.push(`Below target range by ${gap.toFixed(0)}%`);
        return Math.max(0, 1 - gap / 100);
      } else {
        reasoning.push('Above target range (bonus)');
        return 1.0; // Above target is good
      }
    }

    // Calculate overlap ratio
    const oppRange = oppMax - oppMin;
    const overlapRange = overlapEnd - overlapStart;
    const overlapRatio = oppRange > 0 ? overlapRange / oppRange : 1;

    if (overlapRatio >= 0.8) {
      reasoning.push(`Excellent salary alignment: $${(oppMin / 1000).toFixed(0)}k-$${(oppMax / 1000).toFixed(0)}k`);
    } else if (overlapRatio >= 0.5) {
      reasoning.push(`Good salary alignment: $${(oppMin / 1000).toFixed(0)}k-$${(oppMax / 1000).toFixed(0)}k`);
    } else {
      reasoning.push(`Partial salary overlap: $${(oppMin / 1000).toFixed(0)}k-$${(oppMax / 1000).toFixed(0)}k`);
    }

    return overlapRatio;
  }

  /**
   * Calculate location match score (0-1).
   */
  private calculateLocationMatch(opportunity: JobOpportunity, reasoning: string[]): number {
    // Remote preference
    if (this.profile.preferRemote && opportunity.remote) {
      reasoning.push('Remote position matches preference');
      return 1.0;
    }

    // Check location match
    const locationLower = opportunity.location.toLowerCase();
    const profileLocations = this.profile.locations.map(l => l.toLowerCase());

    const locationMatch = profileLocations.some(loc =>
      locationLower.includes(loc) || loc.includes(locationLower)
    );

    if (locationMatch) {
      reasoning.push(`Location match: ${opportunity.location}`);
      return 1.0;
    }

    // Partial credit for remote-friendly if prefer remote
    if (this.profile.preferRemote && opportunity.remote === false) {
      reasoning.push(`Location ${opportunity.location} - not remote`);
      return 0.3;
    }

    reasoning.push(`Location ${opportunity.location} not in preferred list`);
    return 0.2;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RESULTS RETRIEVAL
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get top matches from the last scan.
   */
  getTopMatches(limit: number = 10): CareerMatch[] {
    return this.cachedMatches.slice(0, limit);
  }

  /**
   * Get all cached matches.
   */
  getAllMatches(): CareerMatch[] {
    return [...this.cachedMatches];
  }

  /**
   * Get the timestamp of the last scan.
   */
  getLastScanTime(): string | null {
    return this.lastScanAt;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // REPORT GENERATION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Generate a daily career opportunity report.
   */
  async generateReport(): Promise<string> {
    // Ensure we have fresh data
    if (!this.lastScanAt) {
      await this.scanOpportunities();
    }

    const matches = this.cachedMatches;
    const topMatches = matches.slice(0, 5);

    const lines: string[] = [
      '# Daily Career Opportunity Report',
      '',
      `Generated: ${new Date().toISOString()}`,
      `Last Scan: ${this.lastScanAt ?? 'Never'}`,
      '',
      '## Summary',
      '',
      `- **Total Opportunities Found**: ${matches.length}`,
      `- **Above 70% Match**: ${matches.filter(m => m.matchScore >= 0.7).length}`,
      `- **Above 80% Match**: ${matches.filter(m => m.matchScore >= 0.8).length}`,
      `- **Above 90% Match**: ${matches.filter(m => m.matchScore >= 0.9).length}`,
      '',
      '## Target Profile',
      '',
      `- **Roles**: ${this.profile.targetRoles.join(', ')}`,
      `- **Salary Range**: $${(this.profile.targetSalary.min / 1000).toFixed(0)}k - $${(this.profile.targetSalary.max / 1000).toFixed(0)}k`,
      `- **Remote Preferred**: ${this.profile.preferRemote ? 'Yes' : 'No'}`,
      `- **Key Skills**: ${this.profile.skills.join(', ')}`,
      '',
    ];

    if (topMatches.length > 0) {
      lines.push('## Top Opportunities', '');

      for (let i = 0; i < topMatches.length; i++) {
        const match = topMatches[i];
        const opp = match.opportunity;

        lines.push(
          `### ${i + 1}. ${opp.title} at ${opp.company}`,
          '',
          `- **Match Score**: ${(match.matchScore * 100).toFixed(0)}%`,
          `- **Location**: ${opp.location}${opp.remote ? ' (Remote)' : ''}`,
        );

        if (opp.salary) {
          lines.push(`- **Salary**: $${(opp.salary.min / 1000).toFixed(0)}k - $${(opp.salary.max / 1000).toFixed(0)}k`);
        }

        lines.push(
          `- **Skills**: ${opp.skills.join(', ')}`,
          `- **Source**: [${opp.source}](${opp.sourceUrl})`,
          '',
          '**Match Analysis:**',
          ...match.reasoning.map(r => `- ${r}`),
          '',
        );
      }
    } else {
      lines.push('## No Matching Opportunities', '', 'No opportunities matched your profile criteria.', '');
    }

    // Add source summary
    lines.push(
      '## Sources Checked',
      '',
      ...JOB_SOURCES.filter(s => s.enabled).map(s => `- ${s.name}`),
      '',
      '---',
      '*Report generated by ARI Career Tracker*',
    );

    const report = lines.join('\n');

    log.info(
      { matchCount: matches.length, topScore: topMatches[0]?.matchScore ?? 0 },
      'Report generated'
    );

    return report;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Clear cached matches.
   */
  clearCache(): void {
    this.cachedMatches = [];
    this.lastScanAt = null;
  }

  /**
   * Get statistics about cached matches.
   */
  getStats(): { total: number; avgScore: number; topScore: number; lastScan: string | null } {
    const total = this.cachedMatches.length;
    const avgScore = total > 0
      ? this.cachedMatches.reduce((sum, m) => sum + m.matchScore, 0) / total
      : 0;
    const topScore = total > 0 ? this.cachedMatches[0].matchScore : 0;

    return {
      total,
      avgScore: Math.round(avgScore * 100) / 100,
      topScore: Math.round(topScore * 100) / 100,
      lastScan: this.lastScanAt,
    };
  }

  /**
   * Sleep utility for simulated API calls.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export const careerTracker = new CareerTracker();
