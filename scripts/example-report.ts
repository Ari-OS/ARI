/**
 * Generate an example decision report for demonstration
 */

import { anthropicMonitor } from '../src/autonomous/anthropic-monitor.js';
import { randomUUID } from 'crypto';

async function main() {
  // Create a realistic update based on today's Cowork announcement
  const update = {
    id: randomUUID(),
    source: 'blog' as const,
    title: 'Cowork Plugins: Claude Code for the rest of your work',
    description: 'Plugins let you bundle any skills, connectors, slash commands, and sub-agents together to turn Claude into a specialist for your role, team, and company. We are open-sourcing 11 plugins for sales, finance, legal, data, marketing, support, and more.',
    url: 'https://claude.com/blog/cowork-plugins',
    date: '2026-01-30',
    relevance: 'high' as const,
    category: 'plugin' as const,
    hash: 'cowork-plugins-2026',
  };

  // Generate full decision report
  const report = await anthropicMonitor.generateDecisionReport(update);

  // Format and output
  const notification = anthropicMonitor.formatNotification(report);
  console.log(notification.summary);
}

main().catch(console.error);
