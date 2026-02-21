export default function RagVectors() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4 text-white">RAG Vectors</h1>
      <p className="text-gray-400 mb-8">Vector database state and memory distribution.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-gray-800 rounded-lg border border-gray-700">
          <h2 className="text-xl font-semibold text-white">Hot Memory</h2>
          <div className="mt-4 text-3xl font-bold text-red-400">128</div>
          <span className="text-sm text-gray-500">In-memory / SQLite</span>
        </div>

        <div className="p-6 bg-gray-800 rounded-lg border border-gray-700">
          <h2 className="text-xl font-semibold text-white">Warm Memory</h2>
          <div className="mt-4 text-3xl font-bold text-orange-400">4,096</div>
          <span className="text-sm text-gray-500">Local Qdrant</span>
        </div>

        <div className="p-6 bg-gray-800 rounded-lg border border-gray-700">
          <h2 className="text-xl font-semibold text-white">Cold Memory</h2>
          <div className="mt-4 text-3xl font-bold text-blue-400">14,208</div>
          <span className="text-sm text-gray-500">Persisted archive</span>
        </div>
      </div>
    </div>
  );
}