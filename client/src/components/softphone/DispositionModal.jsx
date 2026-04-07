import { useState, useEffect } from 'react';
import { campaigns as campaignsApi, agents as agentsApi } from '../../services/api';
import { useStore } from '../../store/useStore';
import { X } from 'lucide-react';

export default function DispositionModal({ callId, leadId, onClose }) {
  const [dispositions, setDispositions] = useState([]);
  const [selected, setSelected] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const activeCampaignId = useStore(s => s.activeCampaignId);

  useEffect(() => {
    loadDispositions();
  }, []);

  async function loadDispositions() {
    const data = await campaignsApi.dispositions(activeCampaignId || 'default');
    setDispositions(data || []);
  }

  async function handleSubmit() {
    if (!selected) return;
    setSaving(true);
    await agentsApi.disposition({ callId, dispositionCode: selected, notes: notes || undefined });
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="card w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Disposition Call</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {dispositions.map(d => (
            <button
              key={d.code}
              onClick={() => setSelected(d.code)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                selected === d.code
                  ? 'border-leap-500 bg-leap-600/20 text-leap-400'
                  : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600'
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>

        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Call notes (optional)..."
          className="input mb-4 h-24 resize-none"
        />

        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!selected || saving}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
