import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import type { ReactElement } from 'react';

const MOCK_ACTIVITY_DATA = [
  { time: '08:00', load: 12, agents: 2, tasks: 4 },
  { time: '10:00', load: 24, agents: 5, tasks: 12 },
  { time: '12:00', load: 18, agents: 3, tasks: 8 },
  { time: '14:00', load: 45, agents: 8, tasks: 22 },
  { time: '16:00', load: 38, agents: 6, tasks: 15 },
  { time: '18:00', load: 15, agents: 3, tasks: 5 },
  { time: '20:00', load: 8, agents: 1, tasks: 2 },
];

const MOCK_BUDGET_DATA = [
  { category: 'Code', spend: 45 },
  { category: 'Search', spend: 12 },
  { category: 'Videos', spend: 68 },
  { category: 'Chat', spend: 24 },
  { category: 'Agent', spend: 89 },
];

export default function TheOffice(): ReactElement {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">The Office</h1>
          <p className="text-gray-400">Command Center & Ecosystem Telemetry</p>
        </div>
        <div className="flex items-center gap-3 bg-gray-800/80 px-4 py-2 rounded-lg border border-gray-700">
          <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium text-gray-300">Live WebSocket Connected</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Personal Context Widgets */}
        <div className="p-5 bg-gray-800 rounded-xl border border-gray-700/50 shadow-sm col-span-1 lg:col-span-2">
          <div className="text-gray-400 text-sm font-medium mb-4">Daily Schedule</div>
          <div className="space-y-3">
            <div className="flex justify-between items-center border-l-2 border-blue-500 pl-3">
              <div>
                <div className="text-white font-medium">Deep Work: Architecture</div>
                <div className="text-xs text-gray-400">Project ARI</div>
              </div>
              <div className="text-sm font-mono text-gray-300">09:00 - 11:30</div>
            </div>
            <div className="flex justify-between items-center border-l-2 border-green-500 pl-3">
              <div>
                <div className="text-white font-medium">Sync with Team</div>
                <div className="text-xs text-gray-400">Zoom</div>
              </div>
              <div className="text-sm font-mono text-gray-300">12:00 - 12:30</div>
            </div>
            <div className="flex justify-between items-center border-l-2 border-purple-500 pl-3">
              <div>
                <div className="text-white font-medium">Content Creation</div>
                <div className="text-xs text-gray-400">Recording</div>
              </div>
              <div className="text-sm font-mono text-gray-300">14:00 - 16:00</div>
            </div>
          </div>
        </div>

        <div className="p-5 bg-gray-800 rounded-xl border border-gray-700/50 shadow-sm">
          <div className="text-gray-400 text-sm font-medium mb-1">Active High-Priority Tasks</div>
          <div className="mt-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 mt-1.5 rounded-full bg-red-500"></div>
              <div>
                <div className="text-sm font-medium text-white">Security Hardening</div>
                <div className="text-xs text-gray-400">Fix channel router vulnerability</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 mt-1.5 rounded-full bg-orange-500"></div>
              <div>
                <div className="text-sm font-medium text-white">NLU Pipeline</div>
                <div className="text-xs text-gray-400">Implement multi-intent parsing</div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 bg-gray-800 rounded-xl border border-gray-700/50 shadow-sm">
          <div className="text-gray-400 text-sm font-medium mb-1">Current Budget Burn Rate</div>
          <div className="mt-4">
            <div className="flex justify-between items-end mb-1">
              <div className="text-2xl font-bold text-emerald-400">$2.48</div>
              <div className="text-xs text-gray-500 mb-1">/ day</div>
            </div>
            <div className="h-2 w-full bg-gray-700 rounded-full overflow-hidden mt-3">
              <div className="h-full bg-emerald-500 w-[35%]"></div>
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-400">
              <span>Current: $12.40</span>
              <span>Limit: $35.00</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="p-5 bg-gray-800 rounded-xl border border-gray-700/50 shadow-sm">
          <div className="text-gray-400 text-sm font-medium mb-1">System Status</div>
          <div className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-green-400">Operational</span>
          </div>
          <div className="text-xs text-gray-500 mt-2">Uptime: 99.98%</div>
        </div>

        <div className="p-5 bg-gray-800 rounded-xl border border-gray-700/50 shadow-sm">
          <div className="text-gray-400 text-sm font-medium mb-1">Active Swarms</div>
          <div className="text-2xl font-bold text-blue-400">4</div>
          <div className="text-xs text-gray-500 mt-2">12 Agents Deployed</div>
        </div>

        <div className="p-5 bg-gray-800 rounded-xl border border-gray-700/50 shadow-sm">
          <div className="text-gray-400 text-sm font-medium mb-1">Vector DB Entries</div>
          <div className="text-2xl font-bold text-purple-400">14,208</div>
          <div className="text-xs text-gray-500 mt-2">+124 today</div>
        </div>

        <div className="p-5 bg-gray-800 rounded-xl border border-gray-700/50 shadow-sm">
          <div className="text-gray-400 text-sm font-medium mb-1">Cost Tracking</div>
          <div className="text-2xl font-bold text-emerald-400">$2.48</div>
          <div className="text-xs text-gray-500 mt-2">Daily Burn Rate</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 p-6 bg-gray-800 rounded-xl border border-gray-700/50 shadow-sm">
          <h2 className="text-lg font-semibold text-white mb-6">System Load & Agent Activity</h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_ACTIVITY_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '0.5rem', color: '#f3f4f6' }}
                  itemStyle={{ color: '#e5e7eb' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Area type="monotone" name="CPU/Memory Load" dataKey="load" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorLoad)" />
                <Area type="monotone" name="Task Queue" dataKey="tasks" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorTasks)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-6 bg-gray-800 rounded-xl border border-gray-700/50 shadow-sm">
          <h2 className="text-lg font-semibold text-white mb-6">Budget Burn (LLM Costs)</h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MOCK_BUDGET_DATA} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="category" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: '#374151', opacity: 0.4 }}
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '0.5rem', color: '#f3f4f6' }}
                />
                <Bar name="Spend (cents)" dataKey="spend" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      <div className="p-6 bg-gray-800 rounded-xl border border-gray-700/50 shadow-sm">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Auto-Developer Commits</h2>
        <div className="space-y-4">
          {[
            { id: 'ad-01', target: 'src/autonomous/notification-pipeline.ts', msg: 'Improved batched digest formatting for Priority P3 items', time: '12 mins ago', status: 'Passed' },
            { id: 'ad-02', target: 'dashboard/src/pages/TheOffice.tsx', msg: 'Implemented AreaChart and BarChart using Recharts', time: '1 hr ago', status: 'Passed' },
            { id: 'ad-03', target: 'src/governance/council.ts', msg: 'Added Graduated Veto checks for System Level overrides', time: '3 hrs ago', status: 'Passed' },
          ].map((commit, i) => (
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            <div key={i} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-700/30">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">{commit.id}</span>
                  <span className="text-gray-300 text-sm font-medium">{commit.msg}</span>
                </div>
                <div className="text-xs text-gray-500 font-mono">{commit.target}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-green-400 font-medium">{commit.status}</div>
                <div className="text-xs text-gray-500 mt-1">{commit.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}