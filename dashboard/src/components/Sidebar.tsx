import { useHealth } from '../hooks/useHealth';
import { StatusBadge } from './StatusBadge';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const pages = [
  { id: 'home', label: 'Home', icon: '◉' },
  { id: 'governance', label: 'Governance', icon: '⚖' },
  { id: 'memory', label: 'Memory', icon: '⬢' },
  { id: 'tools', label: 'Tools', icon: '⚙' },
  { id: 'agents', label: 'Agents', icon: '⬡' },
  { id: 'audit', label: 'Audit Log', icon: '⊞' },
];

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { data: health } = useHealth();

  return (
    <aside className="flex w-64 flex-col border-r border-gray-700 bg-gray-900">
      <div className="border-b border-gray-700 p-6">
        <h1 className="text-2xl font-bold text-white">ARI</h1>
        <p className="mt-1 text-xs text-gray-400">Life Operating System</p>
        {health && (
          <div className="mt-3">
            <StatusBadge status={health.status} size="sm" />
          </div>
        )}
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {pages.map((page) => (
            <li key={page.id}>
              <button
                onClick={() => onNavigate(page.id)}
                className={`flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm transition-colors ${
                  currentPage === page.id
                    ? 'bg-blue-900/50 text-blue-300'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-300'
                }`}
              >
                <span className="text-lg">{page.icon}</span>
                {page.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-gray-700 p-4 text-xs text-gray-500">
        <p className="font-mono">v2.0.0</p>
        <p className="mt-1">View-Only Dashboard</p>
      </div>
    </aside>
  );
}
