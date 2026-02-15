/**
 * CareerTracker — Job board scanning and career transition support
 *
 * Matches job listings against Pryce's profile and tracks skill gaps.
 * Generates weekly reports on best opportunities.
 */

import type { EventBus } from '../kernel/event-bus.js';

export interface CareerProfile {
  targetRoles: string[];
  skills: {
    strong: string[];
    moderate: string[];
    learning: string[];
  };
  preferences: {
    remote: boolean;
    hybrid: boolean;
    salaryMin: number;
    location: string;
  };
  differentiators: string[];
}

export interface JobMatch {
  id: string;
  title: string;
  company: string;
  location: string;
  salary?: { min: number; max: number };
  source: string;
  url: string;
  matchScore: number;       // 0-100
  matchReasons: string[];
  missingSkills: string[];
  detectedAt: string;
}

export interface CareerReport {
  weekOf: string;
  newMatches: JobMatch[];
  topMatches: JobMatch[];
  skillGaps: string[];
  recommendation: string;
}

// Default profile for Pryce
const DEFAULT_PROFILE: CareerProfile = {
  targetRoles: [
    'Software Engineer',
    'Full Stack Developer',
    'AI/ML Engineer',
    'TypeScript Developer',
  ],
  skills: {
    strong: ['TypeScript', 'Node.js', 'AI/LLM Integration', 'System Architecture', 'Security'],
    moderate: ['React', 'Python', 'Docker', 'PostgreSQL', 'REST APIs'],
    learning: ['Kubernetes', 'Machine Learning', 'Rust'],
  },
  preferences: {
    remote: true,
    hybrid: true,
    salaryMin: 80000,
    location: 'Eastern US',
  },
  differentiators: [
    'Built ARI — 228-file autonomous AI operating system',
    'Enterprise security architecture',
    'Multi-model AI orchestration',
  ],
};

export class CareerTracker {
  private listings: JobMatch[] = [];
  private profile: CareerProfile;

  constructor(
    private eventBus: EventBus,
    profile?: CareerProfile
  ) {
    this.profile = profile || DEFAULT_PROFILE;
  }

  /**
   * Add a job listing for scoring
   */
  addListing(
    listing: Omit<JobMatch, 'matchScore' | 'matchReasons' | 'missingSkills'>
  ): JobMatch {
    // Check for duplicates
    const exists = this.listings.find((l) => l.id === listing.id);
    if (exists) {
      return exists;
    }

    const scored = this.scoreListing(listing);

    const match: JobMatch = {
      ...listing,
      ...scored,
    };

    this.listings.push(match);

    this.eventBus.emit('audit:log', {
      action: 'job_listing_added',
      agent: 'career-tracker',
      trustLevel: 'system',
      details: { id: listing.id, title: listing.title, matchScore: match.matchScore },
    });

    return match;
  }

  /**
   * Score a listing against Pryce's profile
   */
  scoreListing(listing: {
    title: string;
    company: string;
    location: string;
    salary?: { min: number; max: number };
  }): {
    matchScore: number;
    matchReasons: string[];
    missingSkills: string[];
  } {
    let score = 0;
    const matchReasons: string[] = [];
    const missingSkills: string[] = [];

    const titleLower = listing.title.toLowerCase();
    const companyLower = listing.company.toLowerCase();
    const locationLower = listing.location.toLowerCase();

    // Role match (30 points)
    const roleMatch = this.profile.targetRoles.some((role) =>
      titleLower.includes(role.toLowerCase())
    );
    if (roleMatch) {
      score += 30;
      matchReasons.push('Target role match');
    }

    // Strong skill match (25 points)
    const strongSkillCount = this.profile.skills.strong.filter((skill) =>
      titleLower.includes(skill.toLowerCase())
    ).length;
    if (strongSkillCount > 0) {
      const skillScore = Math.min(25, strongSkillCount * 8);
      score += skillScore;
      matchReasons.push(`${strongSkillCount} strong skill match(es)`);
    }

    // Moderate skill bonus (10 points)
    const moderateSkillCount = this.profile.skills.moderate.filter((skill) =>
      titleLower.includes(skill.toLowerCase())
    ).length;
    if (moderateSkillCount > 0) {
      const skillScore = Math.min(10, moderateSkillCount * 5);
      score += skillScore;
      matchReasons.push(`${moderateSkillCount} moderate skill match(es)`);
    }

    // Identify missing skills
    const allSkills = [
      ...this.profile.skills.strong,
      ...this.profile.skills.moderate,
      ...this.profile.skills.learning,
    ];
    const knownSkillsLower = allSkills.map((s) => s.toLowerCase());
    const commonSkills = ['react', 'angular', 'vue', 'python', 'java', 'go', 'rust', 'kubernetes', 'aws', 'azure', 'gcp'];

    for (const skill of commonSkills) {
      if (titleLower.includes(skill) && !knownSkillsLower.includes(skill)) {
        missingSkills.push(skill);
      }
    }

    // Location preference (15 points)
    const remoteMatch = locationLower.includes('remote');
    const hybridMatch = locationLower.includes('hybrid');
    const locationMatch = locationLower.includes(this.profile.preferences.location.toLowerCase());

    if (this.profile.preferences.remote && remoteMatch) {
      score += 15;
      matchReasons.push('Remote work available');
    } else if (this.profile.preferences.hybrid && hybridMatch) {
      score += 12;
      matchReasons.push('Hybrid work available');
    } else if (locationMatch) {
      score += 10;
      matchReasons.push('Location match');
    }

    // Salary check (15 points)
    if (listing.salary) {
      if (listing.salary.min >= this.profile.preferences.salaryMin) {
        score += 15;
        matchReasons.push(`Salary meets minimum ($${this.profile.preferences.salaryMin.toLocaleString()})`);
      } else {
        matchReasons.push(`Salary below minimum (${listing.salary.min} < ${this.profile.preferences.salaryMin})`);
      }
    }

    // Differentiator bonus (5 points each, max 15)
    const differentiatorKeywords = ['ai', 'ml', 'llm', 'security', 'architecture', 'autonomous'];
    const differentiatorMatches = differentiatorKeywords.filter((kw) =>
      titleLower.includes(kw) || companyLower.includes(kw)
    ).length;

    if (differentiatorMatches > 0) {
      const diffScore = Math.min(15, differentiatorMatches * 5);
      score += diffScore;
      matchReasons.push('Aligns with differentiators (ARI project relevant)');
    }

    return {
      matchScore: Math.min(100, score),
      matchReasons,
      missingSkills,
    };
  }

  /**
   * Get all matches above threshold
   */
  getMatches(minScore: number = 50): JobMatch[] {
    return this.listings
      .filter((l) => l.matchScore >= minScore)
      .sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Generate weekly report
   */
  getWeeklyReport(): CareerReport {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const newMatches = this.listings.filter((l) => {
      const detected = new Date(l.detectedAt);
      return detected >= weekAgo;
    });

    const topMatches = this.getMatches(60).slice(0, 5);
    const skillGaps = this.getSkillGaps();

    const recommendation = this.generateRecommendation(topMatches, skillGaps);

    const weekOfStr = now.toISOString().split('T')[0];

    return {
      weekOf: weekOfStr,
      newMatches,
      topMatches,
      skillGaps,
      recommendation,
    };
  }

  /**
   * Get most requested missing skills
   */
  getSkillGaps(): string[] {
    const skillCounts = new Map<string, number>();

    for (const listing of this.listings) {
      for (const skill of listing.missingSkills) {
        skillCounts.set(skill, (skillCounts.get(skill) || 0) + 1);
      }
    }

    // Sort by frequency
    const sorted = Array.from(skillCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([skill]) => skill);

    return sorted.slice(0, 5);
  }

  /**
   * Generate recommendation based on matches and gaps
   */
  private generateRecommendation(
    topMatches: JobMatch[],
    skillGaps: string[]
  ): string {
    if (topMatches.length === 0) {
      return 'No strong matches this week. Consider expanding search criteria or building skills in: ' +
        skillGaps.slice(0, 3).join(', ');
    }

    const bestMatch = topMatches[0];
    let rec = `Top opportunity: ${bestMatch.title} at ${bestMatch.company} (${bestMatch.matchScore}/100).`;

    if (bestMatch.matchScore >= 80) {
      rec += ' Strong match — apply immediately with tailored resume highlighting ARI project.';
    } else if (bestMatch.matchScore >= 60) {
      rec += ' Good match — prepare application materials this week.';
    }

    if (skillGaps.length > 0) {
      rec += ` Skill gap focus: ${skillGaps.slice(0, 2).join(', ')}.`;
    }

    return rec;
  }
}
