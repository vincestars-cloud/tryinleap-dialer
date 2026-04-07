import { useState, useEffect } from 'react';
import { recordings as recordingsApi } from '../services/api';
import { Play, Download } from 'lucide-react';

export default function RecordingsPage() {
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [playing, setPlaying] = useState(null);

  useEffect(() => { loadRecordings(); }, [page]);

  async function loadRecordings() {
    const data = await recordingsApi.list({ page, limit: 50 });
    setList(data.recordings || []);
    setTotal(data.total || 0);
  }

  function formatDuration(secs) {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Recordings</h2>

      <div className="space-y-3">
        {list.map(rec => (
          <div key={rec.id} className="card py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setPlaying(playing === rec.id ? null : rec.id)}
                className="w-10 h-10 rounded-full bg-leap-600/20 text-leap-400 flex items-center justify-center hover:bg-leap-600/30 transition-colors"
              >
                <Play size={16} />
              </button>
              <div>
                <p className="font-medium">
                  {rec.leads ? `${rec.leads.first_name} ${rec.leads.last_name}` : rec.to_number}
                </p>
                <p className="text-xs text-gray-500">
                  Agent: {rec.agents?.name || 'N/A'} · {formatDuration(rec.duration_seconds)} · {rec.disposition_code || 'No disposition'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">{new Date(rec.started_at).toLocaleString()}</span>
              <a href={rec.recording_url} target="_blank" className="text-gray-500 hover:text-white">
                <Download size={16} />
              </a>
            </div>
          </div>
        ))}

        {list.length === 0 && (
          <div className="card text-center py-12 text-gray-500">No recordings yet</div>
        )}

        {playing && (
          <div className="card py-3">
            <audio
              src={list.find(r => r.id === playing)?.recording_url}
              controls
              autoPlay
              className="w-full"
              onEnded={() => setPlaying(null)}
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{total} recordings</span>
        <div className="flex gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm py-1.5 disabled:opacity-50">Prev</button>
          <button onClick={() => setPage(p => p + 1)} disabled={list.length < 50} className="btn-secondary text-sm py-1.5 disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>
  );
}
