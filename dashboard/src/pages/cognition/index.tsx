/**
 * Cognition Page — Cognitive Layer 0 Dashboard
 *
 * Main entry point for the cognition dashboard.
 * Displays cognitive health, learning status, council profiles, and insights.
 */

import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useWebSocketContext } from '../../contexts/WebSocketContext';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import {
  getCognitiveHealth,
  getLearningStatus,
  getLearningAnalytics,
  getFrameworkUsage,
  getCognitiveInsights,
  getCouncilProfiles,
} from '../../api/client';

import { PillarHealthCard } from './PillarHealthCard';
import { LearningSection } from './LearningSection';
import { CouncilSection } from './CouncilSection';
import { InsightsSection } from './InsightsSection';
import { SourcesSection } from './SourcesSection';
import { ActivityFeed, type CognitiveActivity } from './ActivityFeed';
import { FrameworkUsageChart } from './FrameworkUsageChart';

type TabId = 'overview' | 'council' | 'sources' | 'insights';

function TabNav({ activeTab, onTabChange }: { activeTab: TabId; onTabChange: (tab: TabId) => void }) {
  const tabs: Array<{ id: TabId; label: string; icon: string }> = [
    { id: 'overview', label: 'Overview', icon: '◉' },
    { id: 'council', label: 'Council', icon: '👥' },
    { id: 'sources', label: 'Sources', icon: '📚' },
    { id: 'insights', label: 'Insights', icon: '💡' },
  ];

  return (
    <nav
      role="tablist"
      aria-label="Cognition dashboard tabs"
      className="flex gap-1 p-1 bg-bg-tertiary/60 backdrop-blur-sm rounded-xl border border-border-subtle"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`tabpanel-${tab.id}`}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === tab.id
              ? 'bg-ari-purple text-white shadow-lg shadow-ari-purple-muted'
              : 'text-text-tertiary hover:text-text-primary hover:bg-bg-interactive'
          }`}
        >
          <span className="text-base" aria-hidden="true">
            {tab.icon}
          </span>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

export default function Cognition() {
  const { status: wsStatus } = useWebSocketContext();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [realtimeActivity, setRealtimeActivity] = useState<CognitiveActivity[]>([]);

  // Fetch cognitive health
  const healthQuery = useQuery({
    queryKey: ['cognition', 'health'],
    queryFn: getCognitiveHealth,
    refetchInterval: 30000,
  });

  // Fetch learning status
  const learningQuery = useQuery({
    queryKey: ['cognition', 'learning'],
    queryFn: getLearningStatus,
    refetchInterval: 60000,
  });

  // Fetch learning analytics (retention + focus)
  const analyticsQuery = useQuery({
    queryKey: ['cognition', 'learning-analytics'],
    queryFn: () => getLearningAnalytics({ days: 30 }),
    refetchInterval: 60000,
  });

  // Fetch framework usage
  const usageQuery = useQuery({
    queryKey: ['cognition', 'frameworks'],
    queryFn: getFrameworkUsage,
    refetchInterval: 60000,
  });

  // Fetch insights
  const insightsQuery = useQuery({
    queryKey: ['cognition', 'insights'],
    queryFn: () => getCognitiveInsights(10),
    refetchInterval: 60000,
  });

  // Fetch council profiles
  const profilesQuery = useQuery({
    queryKey: ['cognition', 'council-profiles'],
    queryFn: getCouncilProfiles,
    staleTime: 300000,
  });

  // Simulate real-time activity (in production, this would come from WebSocket)
  useEffect(() => {
    const apis = [
      { api: 'updateBelief', pillar: 'LOGOS' as const },
      { api: 'calculateExpectedValue', pillar: 'LOGOS' as const },
      { api: 'calculateKellyFraction', pillar: 'LOGOS' as const },
      { api: 'analyzeSystem', pillar: 'LOGOS' as const },
      { api: 'detectCognitiveBias', pillar: 'ETHOS' as const },
      { api: 'assessEmotionalState', pillar: 'ETHOS' as const },
      { api: 'checkDiscipline', pillar: 'ETHOS' as const },
      { api: 'reframeThought', pillar: 'PATHOS' as const },
      { api: 'queryWisdom', pillar: 'PATHOS' as const },
      { api: 'analyzeDichotomy', pillar: 'PATHOS' as const },
      { api: 'reflect', pillar: 'PATHOS' as const },
    ];

    const agents = ['Guardian', 'Strategic', 'Financial', 'Risk', 'Ethics', 'Planner', 'Memory', 'Core'];

    const simulateActivity = () => {
      const randomApi = apis[Math.floor(Math.random() * apis.length)];
      const randomAgent = agents[Math.floor(Math.random() * agents.length)];

      const newActivity: CognitiveActivity = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        agent: randomAgent,
        pillar: randomApi.pillar,
        api: randomApi.api,
        confidence: 0.7 + Math.random() * 0.25,
        duration: Math.floor(50 + Math.random() * 200),
      };

      setRealtimeActivity((prev) => [newActivity, ...prev].slice(0, 50));
    };

    // Initial burst of activity
    for (let i = 0; i < 5; i++) {
      setTimeout(simulateActivity, i * 300);
    }

    // Ongoing simulation
    const interval = setInterval(simulateActivity, 2500 + Math.random() * 4000);
    return () => clearInterval(interval);
  }, []);

  // Loading state with purple shimmer
  if (healthQuery.isLoading) {
    return (
      <div className="p-6 space-y-6 bg-ari-radial min-h-screen">
        <Skeleton className="h-16 rounded-xl shimmer-purple" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-56 rounded-xl shimmer-purple" />
          <Skeleton className="h-56 rounded-xl shimmer-purple" />
          <Skeleton className="h-56 rounded-xl shimmer-purple" />
        </div>
      </div>
    );
  }

  // Error state
  if (healthQuery.isError) {
    return <ErrorState message="Failed to load cognitive health data" />;
  }

  const health = healthQuery.data!;
  const learningStatus = learningQuery.data;
  const learningAnalytics = analyticsQuery.data;
  const frameworkUsage = usageQuery.data ?? [];
  const insights = insightsQuery.data ?? [];
  const profiles = profilesQuery.data ?? [];

  return (
    <div className="p-6 space-y-6 bg-ari-radial min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Cognitive Layer 0</h1>
          <p className="text-text-muted text-sm mt-0.5">
            <span className="text-pillar-logos">LOGOS</span>
            <span className="mx-2 opacity-30">•</span>
            <span className="text-pillar-ethos">ETHOS</span>
            <span className="mx-2 opacity-30">•</span>
            <span className="text-pillar-pathos">PATHOS</span>
            <span className="mx-3 opacity-20">—</span>
            <span className="text-text-tertiary">The Three Pillars of Cognition</span>
          </p>
        </div>
        <div className="flex items-center gap-6">
          <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="flex items-center gap-4 pl-4 border-l border-border-muted">
            <div className="text-right">
              <div className="text-xs text-text-muted uppercase tracking-wider">Sources</div>
              <div className="text-lg font-bold text-ari-purple">{health.knowledgeSources}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-text-muted uppercase tracking-wider">Health</div>
              <div
                className={`text-lg font-bold ${
                  health.overall >= 0.8
                    ? 'text-ari-success'
                    : health.overall >= 0.6
                    ? 'text-ari-warning'
                    : 'text-ari-error'
                }`}
              >
                {(health.overall * 100).toFixed(0)}%
              </div>
            </div>
            <div
              className={`w-3 h-3 rounded-full transition-all ${
                wsStatus === 'connected'
                  ? 'bg-ari-success shadow-md shadow-ari-success-muted'
                  : wsStatus === 'connecting' || wsStatus === 'reconnecting'
                  ? 'bg-ari-warning animate-pulse'
                  : 'bg-text-disabled'
              }`}
              title={wsStatus}
            />
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* Three Pillars */}
          <section className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <h2 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-4">Three Pillars</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 stagger-children">
              {health.pillars.map((pillar, index) => (
                <div key={pillar.pillar} style={{ animationDelay: `${index * 0.1}s` }}>
                  <PillarHealthCard pillar={pillar} />
                </div>
              ))}
            </div>
          </section>

          {/* Activity & Learning */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <ActivityFeed activities={realtimeActivity} />
            <LearningSection status={learningStatus} analytics={learningAnalytics} />
          </div>

          {/* Framework Usage & Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <FrameworkUsageChart data={frameworkUsage} />
            <InsightsSection insights={insights} />
          </div>
        </>
      )}

      {activeTab === 'council' && (
        <div className="animate-fade-in-up">
          <CouncilSection profiles={profiles} />
        </div>
      )}

      {activeTab === 'sources' && (
        <div className="animate-fade-in-up">
          <SourcesSection />
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="animate-fade-in-up">
          <InsightsSection insights={insights} />
        </div>
      )}
    </div>
  );
}
