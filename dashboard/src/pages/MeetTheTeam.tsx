export default function MeetTheTeam() {
  const team = [
    { name: 'ATLAS', role: 'Router', icon: '🧭' },
    { name: 'BOLT', role: 'Executor', icon: '⚡' },
    { name: 'ECHO', role: 'Memory Keeper', icon: '📚' },
    { name: 'AEGIS', role: 'Guardian', icon: '🛡️' },
    { name: 'SCOUT', role: 'Risk Assessor', icon: '📊' },
  ];

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4 text-white">Meet The Team</h1>
      <p className="text-gray-400 mb-8">The Autonomous Council governing ARI.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {team.map(member => (
          <div key={member.name} className="flex items-center gap-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
            <div className="text-4xl">{member.icon}</div>
            <div>
              <div className="text-lg font-bold text-white">{member.name}</div>
              <div className="text-sm text-gray-400">{member.role}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}