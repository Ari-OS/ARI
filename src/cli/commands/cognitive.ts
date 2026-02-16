import { Command } from 'commander';

/**
 * Cognitive CLI — Interface to ARI's Layer 0 cognitive architecture.
 *
 * Provides direct access to the three pillars:
 * - LOGOS (Reason): Bayesian, Expected Value, Kelly, Systems, Antifragility
 * - ETHOS (Character): Bias detection, Emotional state, Discipline
 * - PATHOS (Growth): CBT, Stoicism, Wisdom, Practice planning
 *
 * @example
 * ```bash
 * ari cognitive status                    # Show cognitive health
 * ari cognitive analyze "I always fail"   # Bias + CBT analysis
 * ari cognitive decide "Buy stock"        # Full decision pipeline
 * ari cognitive wisdom "uncertainty"      # Query wisdom traditions
 * ari cognitive profile strategist        # Council member profile
 * ```
 */

// =============================================================================
// DISPLAY UTILITIES
// =============================================================================

const PILLAR_ICONS = {
  LOGOS: '🧠',
  ETHOS: '❤️',
  PATHOS: '🌱',
} as const;

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
} as const;

function color(text: string, c: keyof typeof COLORS): string {
  return `${COLORS[c]}${text}${COLORS.reset}`;
}

function header(text: string, icon?: string): string {
  const line = '═'.repeat(60);
  return `\n${line}\n${icon ? icon + ' ' : ''}${color(text, 'bright')}\n${line}`;
}

function subheader(text: string): string {
  return `\n${color('─', 'dim')} ${color(text, 'cyan')} ${color('─'.repeat(50 - text.length), 'dim')}`;
}

function bullet(text: string, indent = 2): string {
  return `${' '.repeat(indent)}${color('•', 'dim')} ${text}`;
}

function progressBar(value: number, width = 20): string {
  const filled = Math.round(value * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const colorCode = value >= 0.8 ? 'green' : value >= 0.5 ? 'yellow' : 'red';
  return color(bar, colorCode);
}

// =============================================================================
// COMMAND REGISTRATION
// =============================================================================

export function registerCognitiveCommand(program: Command): void {
  const cognitive = program
    .command('cognitive')
    .alias('cog')
    .description('Access ARI\'s cognitive layer (LOGOS/ETHOS/PATHOS)');

  // ---------------------------------------------------------------------------
  // STATUS COMMAND
  // ---------------------------------------------------------------------------

  cognitive
    .command('status')
    .description('Show cognitive layer health and activity')
    .option('--json', 'Output as JSON')
    .action((options: { json?: boolean }) => {
      try {
        // Stub - knowledge/learning modules removed
        const sources = [];
        const profiles = [];
        const learningStatus = {
          currentStage: 'PERFORMANCE_REVIEW' as const,
          stageProgress: 0,
          lastReview: new Date(),
          lastGapAnalysis: new Date(),
          lastAssessment: new Date(),
          nextReview: new Date(),
          nextGapAnalysis: new Date(),
          nextAssessment: new Date(),
          recentInsights: [] as Array<{ type: string; description: string }>,
          recentInsightsCount: 0,
          improvementTrend: 'STABLE' as const,
          currentGrade: 'N/A',
          streakDays: 0,
        };
        const recentInsights = learningStatus.recentInsights;

        const logosSources = 0;
        const ethosSources = 0;
        const pathosSources = 0;

        if (options.json) {
          console.log(
            JSON.stringify(
              {
                sources: { total: sources.length, logos: logosSources, ethos: ethosSources, pathos: pathosSources },
                profiles: profiles.length,
                learningStatus,
                recentInsights: recentInsights.length,
              },
              null,
              2
            )
          );
          return;
        }

        console.log(header('COGNITIVE LAYER STATUS', '🎯'));

        // Pillar Health
        console.log(subheader('Three Pillars'));
        console.log(bullet(`${PILLAR_ICONS.LOGOS} LOGOS (Reason):    ${progressBar(0.95)} ${logosSources} sources`));
        console.log(bullet(`${PILLAR_ICONS.ETHOS} ETHOS (Character): ${progressBar(0.92)} ${ethosSources} sources`));
        console.log(bullet(`${PILLAR_ICONS.PATHOS} PATHOS (Growth):   ${progressBar(0.88)} ${pathosSources} sources`));

        // Knowledge
        console.log(subheader('Knowledge System'));
        console.log(bullet(`Total Sources: ${color(String(sources.length), 'bright')}`));
        console.log(bullet(`Council Profiles: ${color(String(profiles.length), 'bright')}`));

        // Learning Loop
        console.log(subheader('Learning Loop'));
        console.log(bullet(`Stage: ${color(learningStatus.currentStage, 'cyan')}`));
        console.log(bullet(`Last Review: ${learningStatus.lastReview.toLocaleDateString()}`));
        console.log(bullet(`Next Review: ${learningStatus.nextReview.toLocaleDateString()}`));
        console.log(bullet(`Trend: ${color(learningStatus.improvementTrend, 'yellow')}`));

        // Recent Insights
        if (recentInsights.length > 0) {
          console.log(subheader('Recent Insights'));
          for (const insight of recentInsights.slice(0, 3)) {
            const typeIcon = { PATTERN: '🔄', SUCCESS: '✓', MISTAKE: '✗', PRINCIPLE: '📖', ANTIPATTERN: '⚠', OPPORTUNITY: '💡', WARNING: '⚠️' }[insight.type] || '•';
            console.log(bullet(`${typeIcon} ${insight.description.substring(0, 60)}...`));
          }
        }

        console.log('\n' + color('Use "ari cognitive --help" for available commands.', 'dim'));
      } catch (error) {
        console.error(color('Error:', 'red'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // ---------------------------------------------------------------------------
  // ANALYZE COMMAND
  // ---------------------------------------------------------------------------

  cognitive
    .command('analyze')
    .description('Analyze text for cognitive biases and distortions')
    .argument('<text>', 'Text to analyze (use quotes for multi-word)')
    .option('--json', 'Output as JSON')
    .option('--expertise <level>', 'Expertise level: novice, intermediate, expert', 'intermediate')
    .action(async (text: string, options: { json?: boolean; expertise?: string }) => {
      try {
        const { detectCognitiveBias } = await import('../../cognition/ethos/index.js');
        const { reframeThought } = await import('../../cognition/pathos/index.js');

        // Run bias detection
        const biasResult = await detectCognitiveBias(text, {
          expertise: options.expertise as 'novice' | 'intermediate' | 'expert',
        });

        // Run CBT reframing
        const reframeResult = await reframeThought(text);

        if (options.json) {
          console.log(JSON.stringify({ biasAnalysis: biasResult, cbtReframe: reframeResult }, null, 2));
          return;
        }

        console.log(header('COGNITIVE ANALYSIS', '🔍'));

        // Bias Detection Results
        console.log(subheader(`${PILLAR_ICONS.ETHOS} ETHOS: Bias Detection`));
        if (biasResult.biasesDetected.length === 0) {
          console.log(bullet(color('No significant biases detected', 'green')));
        } else {
          for (const bias of biasResult.biasesDetected) {
            const severity = bias.severity > 0.7 ? 'red' : bias.severity > 0.4 ? 'yellow' : 'dim';
            console.log(bullet(`${color(bias.type.replace(/_/g, ' '), severity)}: ${(bias.severity * 100).toFixed(0)}%`));
            console.log(`      ${color('→', 'dim')} ${bias.mitigation}`);
          }
        }
        console.log(bullet(`Overall Risk: ${progressBar(1 - biasResult.overallRisk)} ${color(((1 - biasResult.overallRisk) * 100).toFixed(0) + '%', biasResult.overallRisk > 0.5 ? 'red' : 'green')}`));

        // CBT Reframe Results
        console.log(subheader(`${PILLAR_ICONS.PATHOS} PATHOS: CBT Reframe`));
        if (reframeResult.distortionsDetected.length === 0) {
          console.log(bullet(color('No cognitive distortions detected', 'green')));
        } else {
          console.log(bullet('Distortions Found:'));
          for (const d of reframeResult.distortionsDetected) {
            console.log(`      ${color('•', 'yellow')} ${d.type.replace(/_/g, ' ')}`);
          }
        }
        console.log(subheader('Reframed Thought'));
        console.log(`  ${color('"', 'dim')}${reframeResult.reframedThought}${color('"', 'dim')}`);

        console.log(subheader('Balanced Perspective'));
        console.log(`  ${reframeResult.balancedPerspective}`);

        console.log('\n' + color(`Source: ${biasResult.provenance.framework}`, 'dim'));
      } catch (error) {
        console.error(color('Error:', 'red'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // ---------------------------------------------------------------------------
  // DECIDE COMMAND
  // ---------------------------------------------------------------------------

  cognitive
    .command('decide')
    .description('Run full decision analysis pipeline')
    .argument('<decision>', 'Decision to analyze')
    .option('--json', 'Output as JSON')
    .option('--outcomes <json>', 'Outcomes as JSON array [{description, probability, value}]')
    .action(async (decision: string, options: { json?: boolean; outcomes?: string }) => {
      try {
        const { calculateExpectedValue } = await import('../../cognition/logos/index.js');
        const { detectCognitiveBias, runDisciplineCheck } = await import('../../cognition/ethos/index.js');
        // Visualization module removed - will format output manually

        // Parse outcomes or use defaults
        let outcomes: Array<{ description: string; probability: number; value: number }>;
        if (options.outcomes) {
          try {
            outcomes = JSON.parse(options.outcomes) as Array<{ description: string; probability: number; value: number }>;
          } catch {
            console.error(color('Invalid JSON for outcomes', 'red'));
            process.exit(1);
          }
        } else {
          // Default: binary outcome
          outcomes = [
            { description: 'Success', probability: 0.6, value: 100 },
            { description: 'Failure', probability: 0.4, value: -50 },
          ];
        }

        // Run analyses
        const evResult = await calculateExpectedValue({ description: decision, outcomes });
        const biasResult = await detectCognitiveBias(`I want to ${decision}`, { expertise: 'intermediate' });
        const disciplineResult = await runDisciplineCheck(decision, 'core', {});

        if (options.json) {
          console.log(JSON.stringify({ ev: evResult, biases: biasResult, discipline: disciplineResult }, null, 2));
          return;
        }

        // Format output manually (visualization module removed)
        console.log(subheader(`${PILLAR_ICONS.LOGOS} Expected Value`));
        console.log(bullet(`EV: ${evResult.expectedValue.toFixed(2)}`));
        console.log(bullet(`Recommendation: ${evResult.recommendation}`));

        console.log(subheader(`${PILLAR_ICONS.ETHOS} Bias Detection`));
        if (biasResult.biasesDetected.length > 0) {
          for (const bias of biasResult.biasesDetected) {
            const types = String(Array.isArray(bias.type) ? bias.type.join(', ') : bias.type);
            const evidence = String(Array.isArray(bias.evidence) ? bias.evidence.join(', ') : bias.evidence);
            console.log(bullet(`${types}: ${evidence}`));
          }
        } else {
          console.log(bullet('No biases detected'));
        }

        // Discipline check
        console.log(subheader(`${PILLAR_ICONS.ETHOS} Discipline Check`));
        console.log(bullet(`Overall Score: ${progressBar(disciplineResult.overallScore)} ${(disciplineResult.overallScore * 100).toFixed(0)}%`));
        console.log(bullet(`Status: ${disciplineResult.passed ? color('PASSED', 'green') : color('FAILED', 'red')}`));
        if (disciplineResult.violations.length > 0) {
          console.log(bullet('Violations:'));
          for (const v of disciplineResult.violations) {
            console.log(`      ${color('⚠', 'yellow')} ${v}`);
          }
        }
      } catch (error) {
        console.error(color('Error:', 'red'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // ---------------------------------------------------------------------------
  // WISDOM COMMAND
  // ---------------------------------------------------------------------------

  cognitive
    .command('wisdom')
    .description('Query wisdom traditions for guidance')
    .argument('<query>', 'Your question or situation')
    .option('--json', 'Output as JSON')
    .option('--tradition <tradition>', 'Specific tradition: STOIC, DALIO, MUNGER, MUSASHI, NAVAL, TALEB, MEADOWS')
    .action(async (query: string, options: { json?: boolean; tradition?: string }) => {
      try {
        const { queryWisdom } = await import('../../cognition/pathos/index.js');

        const traditions = options.tradition ? [options.tradition.toUpperCase()] : undefined;
        const result = await queryWisdom(query, traditions as undefined);

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        console.log(header('WISDOM COUNCIL', '📜'));

        console.log(subheader(`${result.tradition} Tradition`));
        console.log(bullet(`Principle: ${color(result.principle, 'bright')}`));

        if (result.quote) {
          console.log('\n' + color('  "', 'dim') + color(result.quote, 'cyan') + color('"', 'dim'));
          console.log(color(`  — ${result.source}`, 'dim'));
        }

        console.log(subheader('Application'));
        console.log(`  ${result.application}`);

        if (result.alternatives.length > 0) {
          console.log(subheader('Alternative Perspectives'));
          for (const alt of result.alternatives) {
            console.log(bullet(alt));
          }
        }

        console.log('\n' + color(`Confidence: ${(result.confidence * 100).toFixed(0)}%`, 'dim'));
      } catch (error) {
        console.error(color('Error:', 'red'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // ---------------------------------------------------------------------------
  // PROFILE COMMAND
  // ---------------------------------------------------------------------------

  cognitive
    .command('profile')
    .description('Show Council member cognitive profile')
    .argument('[member]', 'Member ID (e.g., strategist, guardian, advocate)')
    .option('--json', 'Output as JSON')
    .option('--list', 'List all available profiles')
    .action((_member: string | undefined, _options: { json?: boolean; list?: boolean }) => {
      console.error(color('Council profiles not available (knowledge module removed)', 'red'));
      process.exit(1);
    });

  // ---------------------------------------------------------------------------
  // KELLY COMMAND
  // ---------------------------------------------------------------------------

  cognitive
    .command('kelly')
    .description('Calculate optimal position size using Kelly Criterion')
    .requiredOption('-p, --probability <number>', 'Win probability (0-1)')
    .requiredOption('-w, --win <number>', 'Win amount')
    .requiredOption('-l, --loss <number>', 'Loss amount')
    .option('-c, --capital <number>', 'Current capital for dollar amount')
    .option('--json', 'Output as JSON')
    .action(async (options: { probability: string; win: string; loss: string; capital?: string; json?: boolean }) => {
      try {
        const { calculateKellyFraction } = await import('../../cognition/logos/index.js');

        const result = await calculateKellyFraction({
          winProbability: parseFloat(options.probability),
          winAmount: parseFloat(options.win),
          lossAmount: parseFloat(options.loss),
          currentCapital: options.capital ? parseFloat(options.capital) : undefined,
        });

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        console.log(header('KELLY CRITERION ANALYSIS', '📊'));

        console.log(subheader('Position Sizing'));
        console.log(bullet(`Full Kelly:    ${color((result.fullKelly * 100).toFixed(2) + '%', 'bright')}`));
        console.log(bullet(`Half Kelly:    ${(result.halfKelly * 100).toFixed(2)}%`));
        console.log(bullet(`Quarter Kelly: ${(result.quarterKelly * 100).toFixed(2)}%`));

        console.log(subheader('Recommendation'));
        const strategyColor = result.recommendedStrategy === 'avoid' ? 'red' : result.recommendedStrategy === 'quarter' ? 'yellow' : 'green';
        console.log(bullet(`Strategy: ${color(result.recommendedStrategy.toUpperCase(), strategyColor)}`));
        console.log(bullet(`Fraction: ${color((result.recommendedFraction * 100).toFixed(2) + '%', 'bright')}`));

        if (result.dollarAmount !== undefined) {
          console.log(bullet(`Dollar Amount: ${color('$' + result.dollarAmount.toFixed(2), 'cyan')}`));
        }

        console.log(subheader('Edge Analysis'));
        const edgeColor = result.edge > 0 ? 'green' : 'red';
        console.log(bullet(`Edge: ${color((result.edge * 100).toFixed(2) + '%', edgeColor)}`));
        console.log(bullet(`Expected Growth: ${(result.expectedGrowthRate * 100).toFixed(4)}%`));

        if (result.warnings.length > 0) {
          console.log(subheader('Warnings'));
          for (const w of result.warnings) {
            console.log(bullet(color(w, 'yellow')));
          }
        }

        console.log('\n' + color(`Source: ${result.provenance.framework}`, 'dim'));
      } catch (error) {
        console.error(color('Error:', 'red'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // ---------------------------------------------------------------------------
  // BAYESIAN COMMAND
  // ---------------------------------------------------------------------------

  cognitive
    .command('bayesian')
    .description('Update belief probability with new evidence')
    .requiredOption('-h, --hypothesis <text>', 'Hypothesis statement')
    .requiredOption('-p, --prior <number>', 'Prior probability (0-1)')
    .requiredOption('-r, --ratio <number>', 'Likelihood ratio (evidence strength)')
    .option('-s, --strength <level>', 'Evidence strength: weak, moderate, strong', 'moderate')
    .option('--json', 'Output as JSON')
    .action(
      async (options: { hypothesis: string; prior: string; ratio: string; strength?: string; json?: boolean }) => {
        try {
          const { updateBelief } = await import('../../cognition/logos/index.js');

          const result = await updateBelief(
            { hypothesis: options.hypothesis, priorProbability: parseFloat(options.prior) },
            {
              description: 'Evidence from CLI',
              likelihoodRatio: parseFloat(options.ratio),
              strength: (options.strength || 'moderate') as 'weak' | 'moderate' | 'strong',
            }
          );

          if (options.json) {
            console.log(JSON.stringify(result, null, 2));
            return;
          }

          console.log(header('BAYESIAN UPDATE', '🎲'));

          console.log(subheader('Hypothesis'));
          console.log(`  ${color(result.hypothesis, 'cyan')}`);

          console.log(subheader('Probability Update'));
          const shiftColor = result.shift > 0 ? 'green' : result.shift < 0 ? 'red' : 'dim';
          console.log(bullet(`Prior:     ${progressBar(result.priorProbability)} ${(result.priorProbability * 100).toFixed(1)}%`));
          console.log(bullet(`Posterior: ${progressBar(result.posteriorProbability)} ${(result.posteriorProbability * 100).toFixed(1)}%`));
          console.log(bullet(`Shift:     ${color((result.shift > 0 ? '+' : '') + (result.shift * 100).toFixed(1) + '%', shiftColor)}`));

          console.log(subheader('Interpretation'));
          console.log(`  ${result.interpretation}`);

          console.log('\n' + color(`Confidence: ${(result.confidence * 100).toFixed(0)}% | Source: ${result.provenance.framework}`, 'dim'));
        } catch (error) {
          console.error(color('Error:', 'red'), error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      }
    );
}
