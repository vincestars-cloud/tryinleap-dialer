import { useState, useEffect } from 'react';
import { campaigns as campaignsApi, agents as agentsApi } from '../services/api';
import { Plus, Edit2, Trash2, Users, Settings } from 'lucide-react';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [agents, setAgents] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [c, a] = await Promise.all([campaignsApi.list(), agentsApi.list()]);
    setCampaigns(c);
    setAgents(a);
    setLoading(false);
  }

  async function handleDelete(id) {
    if (!confirm('Delete this campaign?')) return;
    await campaignsApi.delete(id);
    loadData();
  }

  if (loading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Campaigns</h2>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
          <Plus size={14} className="inline mr-1" /> New Campaign
        </button>
      </div>

      <div className="grid gap-4">
        {campaigns.map(c => (
          <div key={c.id} className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">{c.name}</h3>
                {c.description && <p className="text-sm text-gray-500">{c.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`badge ${c.status === 'active' ? 'badge-green' : c.status === 'paused' ? 'badge-yellow' : 'badge-gray'}`}>
                  {c.status}
                </span>
                <button onClick={() => setEditingId(c.id)} className="p-2 text-gray-500 hover:text-white rounded-lg hover:bg-gray-800">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => handleDelete(c.id)} className="p-2 text-gray-500 hover:text-red-400 rounded-lg hover:bg-gray-800">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500">Mode</p>
                <p className="font-medium capitalize">{c.dial_mode}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Ratio</p>
                <p className="font-medium">{c.dial_ratio}:1</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Leads</p>
                <p className="font-medium">{c.total_leads || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Dialed</p>
                <p className="font-medium">{c.dialed_leads || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Max Attempts</p>
                <p className="font-medium">{c.max_attempts}</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-leap-500 rounded-full transition-all"
                  style={{ width: `${c.total_leads ? (c.dialed_leads / c.total_leads * 100) : 0}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {c.total_leads ? Math.round(c.dialed_leads / c.total_leads * 100) : 0}% dialed
              </p>
            </div>
          </div>
        ))}

        {campaigns.length === 0 && (
          <div className="card text-center py-12">
            <p className="text-gray-500 mb-4">No campaigns yet</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">Create Your First Campaign</button>
          </div>
        )}
      </div>

      {(showCreate || editingId) && (
        <CampaignModal
          campaignId={editingId}
          agents={agents}
          onClose={() => { setShowCreate(false); setEditingId(null); loadData(); }}
        />
      )}
    </div>
  );
}

function CampaignModal({ campaignId, agents, onClose }) {
  const [form, setForm] = useState({
    name: '', description: '', dial_mode: 'predictive', dial_ratio: 2.0,
    caller_id: '', max_attempts: 3, retry_delay_minutes: 60, voicemail_drop_url: ''
  });
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (campaignId) loadCampaign();
  }, [campaignId]);

  async function loadCampaign() {
    const data = await campaignsApi.get(campaignId);
    setForm({
      name: data.name, description: data.description || '', dial_mode: data.dial_mode,
      dial_ratio: data.dial_ratio, caller_id: data.caller_id, max_attempts: data.max_attempts,
      retry_delay_minutes: data.retry_delay_minutes, voicemail_drop_url: data.voicemail_drop_url || ''
    });
    setSelectedAgents(data.agents?.map(a => a.id) || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    if (campaignId) {
      await campaignsApi.update(campaignId, form);
      await campaignsApi.assignAgents(campaignId, selectedAgents);
    } else {
      const created = await campaignsApi.create(form);
      if (selectedAgents.length > 0) {
        await campaignsApi.assignAgents(created.id, selectedAgents);
      }
    }
    setSaving(false);
    onClose();
  }

  function toggleAgent(id) {
    setSelectedAgents(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  }

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 overflow-y-auto py-8">
      <form onSubmit={handleSubmit} className="card w-full max-w-lg space-y-4">
        <h3 className="text-lg font-semibold">{campaignId ? 'Edit' : 'Create'} Campaign</h3>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Campaign Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} className="input" required />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Description</label>
          <input value={form.description} onChange={e => set('description', e.target.value)} className="input" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Dial Mode</label>
            <select value={form.dial_mode} onChange={e => set('dial_mode', e.target.value)} className="input">
              <option value="predictive">Predictive</option>
              <option value="progressive">Progressive</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Dial Ratio (predictive)</label>
            <input type="number" step="0.5" min="1" max="5" value={form.dial_ratio} onChange={e => set('dial_ratio', parseFloat(e.target.value))} className="input" />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Caller ID (phone number)</label>
          <input value={form.caller_id} onChange={e => set('caller_id', e.target.value)} placeholder="Leave blank to use default" className="input" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Max Attempts</label>
            <input type="number" min="1" max="10" value={form.max_attempts} onChange={e => set('max_attempts', parseInt(e.target.value))} className="input" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Retry Delay (minutes)</label>
            <input type="number" min="1" value={form.retry_delay_minutes} onChange={e => set('retry_delay_minutes', parseInt(e.target.value))} className="input" />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Voicemail Drop URL (optional)</label>
          <input value={form.voicemail_drop_url} onChange={e => set('voicemail_drop_url', e.target.value)} placeholder="https://..." className="input" />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Assign Agents</label>
          <div className="flex flex-wrap gap-2">
            {agents.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => toggleAgent(a.id)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  selectedAgents.includes(a.id)
                    ? 'border-leap-500 bg-leap-600/20 text-leap-400'
                    : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                }`}
              >
                {a.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? 'Saving...' : campaignId ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
