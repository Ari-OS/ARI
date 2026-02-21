export default function ContentPipeline() {
  const videos = [
    { id: 'vid_123', card: 'Charizard ex', trend: 'spike', status: 'published', date: '2 hrs ago' },
    { id: 'vid_124', card: 'Pikachu Illustrator', trend: 'spike', status: 'ready_to_publish', date: '1 hr ago' },
    { id: 'vid_125', card: 'Lugia V Alt Art', trend: 'crash', status: 'generating_assets', date: '10 min ago' },
    { id: 'vid_126', card: 'Umbreon VMAX', trend: 'crash', status: 'pending_script', date: 'Just now' },
  ];

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4 text-white">Content Pipeline</h1>
      <p className="text-gray-400 mb-8">Pokemon TCG Automated Video Generation Queue.</p>

      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <table className="w-full text-left text-sm text-gray-400">
          <thead className="bg-gray-900 text-gray-300 uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Card</th>
              <th className="px-6 py-4">Trend</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Last Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {videos.map(vid => (
              <tr key={vid.id} className="hover:bg-gray-750 transition-colors">
                <td className="px-6 py-4 font-medium text-white">{vid.card}</td>
                <td className="px-6 py-4">
                  {vid.trend === 'spike' ? (
                    <span className="text-green-400 font-bold">↑ Spike</span>
                  ) : (
                    <span className="text-red-400 font-bold">↓ Crash</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    vid.status === 'published' ? 'bg-blue-900 text-blue-300' :
                    vid.status === 'ready_to_publish' ? 'bg-green-900 text-green-300' :
                    vid.status === 'generating_assets' ? 'bg-yellow-900 text-yellow-300' :
                    'bg-gray-700 text-gray-300'
                  }`}>
                    {vid.status.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4">{vid.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}