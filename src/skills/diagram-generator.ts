/**
 * ARI Architecture Diagram Generator
 *
 * Generates Mermaid diagrams from live codebase analysis:
 * - layers: 7-layer architecture with components and dependencies
 * - scheduler: Daily timeline of all 30+ scheduled tasks
 * - notifications: EventBus → PriorityScorer → channel routing flow
 * - data-flow: Intelligence → analysis → briefing → delivery pipeline
 * - eventbus: Pub/sub topology matrix (top event flows)
 */

import fs from 'node:fs/promises';
import path from 'node:path';

export type DiagramType = 'layers' | 'scheduler' | 'notifications' | 'data-flow' | 'eventbus' | 'all';

export interface DiagramResult {
  type: string;
  title: string;
  mermaid: string;
}

// ── Layer Architecture Diagram ─────────────────────────────────────────

function generateLayersDiagram(): DiagramResult {
  const mermaid = `graph TB
    subgraph L6["Layer 6: INTERFACES"]
        CLI["CLI<br/>23 commands"]
        Dashboard["Dashboard<br/>React UI"]
        API["REST API<br/>Fastify"]
        TelegramBot["Telegram Bot<br/>grammY"]
    end

    subgraph L5["Layer 5: EXECUTION"]
        Daemon["Daemon<br/>launchd"]
        HealthMon["Health Monitor"]
        GitSync["Git Sync<br/>Hourly"]
        Scheduler["Scheduler<br/>30+ tasks"]
    end

    subgraph L5A["Layer 5: AUTONOMOUS"]
        Agent["Autonomous Agent<br/>Main loop"]
        Briefings["Briefings<br/>Morning/Evening"]
        MarketMon["Market Monitor<br/>Anomaly detection"]
        IntelScanner["Intelligence<br/>Scanner"]
        ContentEngine["Content Engine<br/>Draft pipeline"]
        NotifMgr["Notification<br/>Manager"]
    end

    subgraph L4["Layer 4: STRATEGIC"]
        Council["Council<br/>15 members"]
        Arbiter["Arbiter<br/>6 rules"]
        Overseer["Overseer<br/>5 gates"]
        PolicyEngine["Policy Engine<br/>Permissions"]
    end

    subgraph L3["Layer 3: AGENTS"]
        Core["Core<br/>Orchestrator"]
        Guardian["Guardian<br/>Threat detection"]
        Planner["Planner<br/>Task decomposition"]
        Executor["Executor<br/>Tool invocation"]
        MemMgr["Memory Manager<br/>Provenance tracking"]
    end

    subgraph L2["Layer 2: SYSTEM"]
        Router["Router<br/>Event dispatch"]
        Storage["Storage<br/>Context mgmt"]
        VectorStore["Vector Store<br/>SQLite embeddings"]
    end

    subgraph L1["Layer 1: KERNEL"]
        Gateway["Gateway<br/>127.0.0.1:3141"]
        Sanitizer["Sanitizer<br/>39 patterns"]
        Audit["Audit<br/>SHA-256 chain"]
        EventBus["EventBus<br/>195+ events"]
    end

    subgraph L0["Layer 0: COGNITIVE"]
        LOGOS["LOGOS<br/>Bayesian · Kelly · EV"]
        ETHOS["ETHOS<br/>Bias · Emotion"]
        PATHOS["PATHOS<br/>CBT · Stoicism"]
    end

    L6 --> L5
    L5 --> L5A
    L5A --> L4
    L4 --> L3
    L3 --> L2
    L2 --> L1
    L1 --> L0

    EventBus -.->|"pub/sub"| L2
    EventBus -.->|"pub/sub"| L3
    EventBus -.->|"pub/sub"| L4
    EventBus -.->|"pub/sub"| L5A

    style L0 fill:#2d3748,stroke:#4a5568,color:#fff
    style L1 fill:#c53030,stroke:#9b2c2c,color:#fff
    style L2 fill:#d69e2e,stroke:#b7791f,color:#fff
    style L3 fill:#38a169,stroke:#2f855a,color:#fff
    style L4 fill:#3182ce,stroke:#2c5282,color:#fff
    style L5 fill:#805ad5,stroke:#6b46c1,color:#fff
    style L5A fill:#6b46c1,stroke:#553c9a,color:#fff
    style L6 fill:#d53f8c,stroke:#b83280,color:#fff`;

  return {
    type: 'layers',
    title: 'ARI 7-Layer Architecture',
    mermaid,
  };
}

// ── Scheduler Timeline Diagram ─────────────────────────────────────────

function generateSchedulerDiagram(): DiagramResult {
  const mermaid = `gantt
    title ARI Daily Task Schedule
    dateFormat HH:mm
    axisFormat %H:%M

    section Essential
    Daily Backup                  :backup,    03:00, 15min
    Intelligence Scan             :intel,     06:00, 15min
    Life Monitor Scan             :life,      06:15, 10min
    Morning Briefing              :crit, morning, 06:30, 15min
    Daily Digest Delivery         :digest,    06:45, 10min
    User Daily Brief              :crit, brief, 07:30, 15min
    Pre-Market Briefing (M-F)    :crit, premarket, 09:15, 10min
    Post-Market Briefing (M-F)   :crit, postmarket, 16:15, 10min
    Changelog Generation          :changelog, 19:00, 15min
    Evening Summary               :crit, evening, 21:00, 15min

    section Investment
    Market Background Collect     :market, 00:00, 15min
    Opportunity Daily Scan        :opp, 07:00, 15min
    Portfolio Update AM (M-F)    :port1, 09:10, 5min
    Portfolio Update PM (M-F)    :port2, 16:10, 5min

    section Content
    Content Draft Generation      :draft, 07:00, 20min
    Content Draft Delivery        :deliver, 07:30, 10min

    section Knowledge
    Knowledge Index Morning       :know1, 08:00, 15min
    Knowledge Index Afternoon     :know2, 14:00, 15min
    Knowledge Index Evening       :know3, 20:00, 15min

    section Proactive
    Initiative Scan               :init1, 06:00, 20min
    Career Scan (M-F)            :career, 06:10, 10min
    Initiative Midday Check       :init2, 14:00, 10min
    Model Evolution (Mon)        :model, 10:00, 15min

    section Strategic
    Self-Improvement Analysis     :self, 21:30, 15min
    AI Council Nightly            :council, 22:00, 30min

    section Recurring
    Agent Health Check            :active, health, 00:00, 1440min
    Git Sync                      :active, git, 00:00, 1440min`;

  return {
    type: 'scheduler',
    title: 'ARI Daily Task Schedule',
    mermaid,
  };
}

// ── Notification Flow Diagram ──────────────────────────────────────────

function generateNotificationsDiagram(): DiagramResult {
  const mermaid = `flowchart TD
    subgraph Sources["Event Sources"]
        Market["Market Monitor<br/>price alerts, flash crash"]
        Intel["Intelligence Scanner<br/>AI news, GitHub trends"]
        Budget["Budget Tracker<br/>spend warnings"]
        Security["Guardian<br/>security alerts"]
        Career["Career Tracker<br/>job matches"]
        Ops["Health Monitor<br/>system alerts"]
        Governance["Council/Arbiter<br/>votes, rulings"]
    end

    EventBus["EventBus<br/>195+ typed events"]

    subgraph Router["Notification Router"]
        Classify["Event Classification<br/>finance · security · ops · career"]
        Score["Priority Scoring<br/>P0 critical → P3 info"]
        Cooldown["Cooldown Check<br/>finance: 4hr · ops: 30min<br/>security: 15min · opportunity: 1hr"]
        QuietHours["Quiet Hours Filter<br/>11PM-6AM (P0 bypass)"]
    end

    subgraph Manager["Notification Manager"]
        Queue["Priority Queue<br/>score ≥ 75 threshold"]
        Format["Message Formatter<br/>severity + context"]
    end

    subgraph Channels["Delivery Channels"]
        Telegram["Telegram<br/>Primary channel"]
        Notion["Notion<br/>Knowledge store"]
        Briefing["Briefing Queue<br/>Deferred to next briefing"]
    end

    Sources --> EventBus
    EventBus --> Classify
    Classify --> Score
    Score --> Cooldown
    Cooldown -->|"Pass"| QuietHours
    Cooldown -->|"Cooldown active"| Briefing
    QuietHours -->|"Active hours"| Queue
    QuietHours -->|"Quiet + P0"| Queue
    QuietHours -->|"Quiet + P1-P3"| Briefing
    Queue --> Format
    Format --> Telegram
    Format --> Notion

    style EventBus fill:#805ad5,stroke:#6b46c1,color:#fff
    style Telegram fill:#0088cc,stroke:#006699,color:#fff
    style Notion fill:#000,stroke:#333,color:#fff
    style Security fill:#c53030,stroke:#9b2c2c,color:#fff
    style Budget fill:#d69e2e,stroke:#b7791f,color:#fff`;

  return {
    type: 'notifications',
    title: 'ARI Notification Pipeline',
    mermaid,
  };
}

// ── Data Flow Diagram ──────────────────────────────────────────────────

function generateDataFlowDiagram(): DiagramResult {
  const mermaid = `flowchart LR
    subgraph Sources["Data Sources"]
        direction TB
        Anthropic["Anthropic Blog"]
        OpenAI["OpenAI Blog"]
        HN["Hacker News"]
        GitHub["GitHub Trending"]
        XTwitter["X/Twitter"]
        Yahoo["Yahoo Finance"]
        CoinGecko["CoinGecko"]
        Indeed["Indeed Jobs"]
    end

    subgraph Collection["Collection Layer"]
        IntelScanner["Intelligence<br/>Scanner<br/>6 AM daily"]
        MarketMon["Market<br/>Monitor<br/>Every 4hr"]
        CareerTracker["Career<br/>Tracker<br/>6:10 AM M-F"]
        OpScanner["Opportunity<br/>Scanner<br/>7 AM daily"]
    end

    subgraph Analysis["Analysis Layer"]
        TrendAnalyzer["Trend<br/>Analyzer"]
        InvestAnalyzer["Investment<br/>Analyzer"]
        RiskScorer["Risk<br/>Scorer"]
        Baseline["Rolling<br/>Baseline<br/>7-day window"]
    end

    subgraph Generation["Generation Layer"]
        ContentDrafter["Content<br/>Drafter<br/>AI-powered"]
        BriefingGen["Briefing<br/>Generator"]
        DigestGen["Daily Digest<br/>Generator"]
        DraftQueue["Draft<br/>Queue"]
    end

    subgraph Delivery["Delivery Layer"]
        MorningBrief["Morning<br/>Briefing<br/>6:30 AM"]
        EveningSum["Evening<br/>Summary<br/>9 PM"]
        TelegramDel["Telegram<br/>Delivery"]
        NotionDel["Notion<br/>Pages"]
        ContentPub["X/Twitter<br/>Publisher"]
    end

    Sources --> Collection
    Collection --> Analysis
    Analysis --> Generation
    Generation --> Delivery

    Anthropic & OpenAI & HN & GitHub & XTwitter --> IntelScanner
    Yahoo & CoinGecko --> MarketMon
    Indeed --> CareerTracker

    IntelScanner --> TrendAnalyzer
    IntelScanner --> DigestGen
    MarketMon --> Baseline
    MarketMon --> InvestAnalyzer
    OpScanner --> RiskScorer

    TrendAnalyzer --> ContentDrafter
    ContentDrafter --> DraftQueue
    BriefingGen --> MorningBrief
    BriefingGen --> EveningSum
    DigestGen --> TelegramDel

    DraftQueue -->|"approved"| ContentPub
    MorningBrief --> TelegramDel
    EveningSum --> TelegramDel
    MorningBrief --> NotionDel

    style Sources fill:#134e4a,stroke:#10b981,color:#fff
    style Collection fill:#1e3a8a,stroke:#3b82f6,color:#fff
    style Analysis fill:#7c2d12,stroke:#f97316,color:#fff
    style Generation fill:#4a1a4a,stroke:#9333ea,color:#fff
    style Delivery fill:#0088cc,stroke:#006699,color:#fff`;

  return {
    type: 'data-flow',
    title: 'ARI Data Pipeline',
    mermaid,
  };
}

// ── EventBus Topology Diagram ──────────────────────────────────────────

function generateEventBusDiagram(): DiagramResult {
  const mermaid = `flowchart TD
    subgraph Kernel["L1 Kernel"]
        GW["Gateway"]
        SAN["Sanitizer"]
        AUD["Audit"]
        EB["EventBus"]
    end

    subgraph Agents["L3 Agents"]
        CORE["Core"]
        GUARD["Guardian"]
        EXEC["Executor"]
        MEM["Memory Mgr"]
    end

    subgraph Governance["L4 Strategic"]
        COUNCIL["Council"]
        ARBITER["Arbiter"]
        OVERSEER["Overseer"]
        POLICY["Policy Engine"]
    end

    subgraph Autonomous["L5 Autonomous"]
        SCHED["Scheduler"]
        BRIEF["Briefings"]
        MARKET["Market Mon"]
        NOTIF["Notification Mgr"]
        NROUTER["Notification Router"]
        INTEL["Intel Scanner"]
        BUDGET["Budget Tracker"]
    end

    subgraph Plugins["Plugins"]
        TGBOT["Telegram Bot"]
        CRYPTO["Crypto Plugin"]
        CONTENT["Content Engine"]
    end

    subgraph Observability["Observability"]
        COST["Cost Tracker"]
        METRICS["Metrics"]
        VALANA["Value Analytics"]
        EXHIST["Execution History"]
    end

    GW -->|"message:received<br/>security:detected"| EB
    SAN -->|"security:detected"| EB
    AUD -->|"audit:logged"| EB

    EB -->|"message:accepted"| CORE
    EB -->|"message:accepted"| GUARD
    EB -->|"message:accepted"| SCHED

    CORE -->|"message:response"| EB
    GUARD -->|"security:alert"| EB
    EXEC -->|"tool:executed"| EB
    MEM -->|"memory:stored"| EB

    EB -->|"security:alert"| ARBITER
    EB -->|"security:alert"| OVERSEER
    COUNCIL -->|"vote:*"| EB
    POLICY -->|"permission:*"| EB

    SCHED -->|"scheduler:task_*"| EB
    MARKET -->|"market:price_alert<br/>market:flash_crash"| EB
    INTEL -->|"intelligence:*"| EB
    BRIEF -->|"briefing:*_delivered"| EB
    BUDGET -->|"budget:warning<br/>budget:critical"| EB

    EB -->|"budget:*<br/>security:*<br/>investment:*"| NROUTER
    NROUTER --> NOTIF
    NOTIF --> TGBOT

    CRYPTO -->|"crypto:*"| EB
    CONTENT -->|"content:*"| EB

    EB -->|"cost:tracked"| COST
    EB -->|"scheduler:task_*"| EXHIST
    EB -->|"briefing:*<br/>initiative:*"| VALANA
    EB -->|"audit:log"| METRICS

    style EB fill:#805ad5,stroke:#6b46c1,color:#fff,stroke-width:3px
    style Kernel fill:#c53030,stroke:#9b2c2c,color:#fff
    style Agents fill:#38a169,stroke:#2f855a,color:#fff
    style Governance fill:#3182ce,stroke:#2c5282,color:#fff
    style Autonomous fill:#6b46c1,stroke:#553c9a,color:#fff
    style Plugins fill:#d53f8c,stroke:#b83280,color:#fff
    style Observability fill:#d69e2e,stroke:#b7791f,color:#fff`;

  return {
    type: 'eventbus',
    title: 'ARI EventBus Topology',
    mermaid,
  };
}

// ── Public API ─────────────────────────────────────────────────────────

const GENERATORS: Record<string, () => DiagramResult> = {
  layers: generateLayersDiagram,
  scheduler: generateSchedulerDiagram,
  notifications: generateNotificationsDiagram,
  'data-flow': generateDataFlowDiagram,
  eventbus: generateEventBusDiagram,
};

export function generateDiagram(type: DiagramType): DiagramResult[] {
  if (type === 'all') {
    return Object.values(GENERATORS).map((gen) => gen());
  }

  const generator = GENERATORS[type];
  if (!generator) {
    throw new Error(`Unknown diagram type: ${type}. Available: ${Object.keys(GENERATORS).join(', ')}, all`);
  }

  return [generator()];
}

export function getAvailableTypes(): string[] {
  return [...Object.keys(GENERATORS), 'all'];
}

export async function saveDiagrams(
  diagrams: DiagramResult[],
  outputDir: string
): Promise<string[]> {
  await fs.mkdir(outputDir, { recursive: true });
  const paths: string[] = [];

  for (const diagram of diagrams) {
    const content = `# ${diagram.title}\n\n\`\`\`mermaid\n${diagram.mermaid}\n\`\`\`\n`;
    const filePath = path.join(outputDir, `${diagram.type}.md`);
    await fs.writeFile(filePath, content);
    paths.push(filePath);
  }

  return paths;
}
