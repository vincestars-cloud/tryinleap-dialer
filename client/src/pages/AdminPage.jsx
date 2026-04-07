import { useState, useEffect } from 'react';
import { agents as agentsApi, auth, dialer as dialerApi } from '../services/api';
import { useStore } from '../store/useStore';
import { UserPlus, Shield, Activity, RefreshCw } from 'lucide-react';

export default function AdminPage() {
  const agent = useStore(s => s.agent);
  const [agentList, setAgentList] = useState([]);
  const [stats, setStats] = useState(null);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    const [a, s] = await Promise.all([agentsApi.list(), dialerApi.stats()]);
    setAgentList(a);
    setStats(s);
    setLoading(false);
  }

  async function loadStats() {
    try {
      const s = await dialerApi.stats();
      setStats(s);
    } catch {}
  }

  if (loading) return <div className="text-gray-500">Loading...</div>;

  const statusCounts = {
    available: agentList.filter(a => a.liveStatus === 'available').length,
    on_call: agentList.filter(a => a.liveStatus === 'on_call').length,
    wrap_up: agentList.filter(a => a.liveStatus === 'wrap_up').length,
    paused: agentList.filter(a => a.liveStatus === 'paused').length,
    offline: agentList.filter(a => a.liveStatus === 'offline').length
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Admin Panel</h2>
        <div className="flex gap-2">
          <button onClick={loadData} className="btn-secondary text-sm">
            <RefreshCw size={14} className="inline mr-1" /> Refresh
          </button>
          <button onClick={() => setShowAddAgent(true)} className="btn-primary text-sm">
            <UserPlus size={14} className="inline mr-1" /> Add Agent
          </button>
        </div>
      </div>

      {/* Live Stats */}
      <div className="grid grid-cols-5 gap-3">
        <StatBox label="Available" value={statusCounts.available} color="green" />
        <StatBox label="On Call" value={statusCounts.on_call} color="blue" />
        <StatBox label="Wrap Up" value={statusCounts.wrap_up} color="yellow" />
        <StatBox label="Paused" value={statusCounts.paused} color="orange" />
        <StatBox label="Offline" value={statusCounts.offline} color="gray" />
      </div>

      {/* Dialer Engine Stats */}
      {stats && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity size={18} className="text-leap-400" />
            Dialer Engine
          </h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500">Active Campaigns</p>
              <p className="text-xl font-bold">{stats.activeCampaigns}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Live Calls</p>
              <p className="text-xl font-bold">{stats.pendingCalls}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Queued Calls</p>
              <p className="text-xl font-bold">{stats.queuedCalls}</p>
            </div>
          </div>

          {Object.entries(stats.campaigns || {}).length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-800 space-y-2">
              {Object.entries(stats.campaigns).map(([id, cs]) => (
                <div key={id} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-2">
                  <span className="text-sm font-medium">{cs.name}</span>
                  <span className="text-xs text-gray-400">
                    {cs.mode} · ratio {cs.ratio} · {cs.activeCalls} calls · {cs.availableAgents} agents
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Agent List */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Agents</h3>
        <div className="space-y-2">
          {agentList.map(a => (
            <div key={a.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  a.liveStatus === 'available' ? 'bg-green-400' :
                  a.liveStatus === 'on_call' ? 'bg-blue-400 animate-pulse' :
                  a.liveStatus === 'wrap_up' ? 'bg-yellow-400' :
                  a.liveStatus === 'paused' ? 'bg-orange-400' : 'bg-gray-600'
                }`} />
                <div>
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-gray-500">{a.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`badge ${a.role === 'admin' ? 'badge-yellow' : 'badge-gray'}`}>{a.role}</span>
                <span className="text-xs text-gray-500 capitalize">{a.liveStatus}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showAddAgent && <AddAgentModal onClose={() => { setShowAddAgent(false); loadData(); }} />}
    </div>
  );
}

function StatBox({ label, value, color }) {
  const colors = {
    green: 'border-green-800 text-green-400',
    blue: 'border-blue-800 text-blue-400',
    yellow: 'border-yellow-800 text-yellow-400',
    orange: 'border-orange-800 text-orange-400',
    gray: 'border-gray-800 text-gray-400'
  };

  return (
    <div className={`card text-center border ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-1">{label}</p>
    </div>
  );
}

function AddAgentModal({ onClose }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'agent' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await auth.register(form);
      onClose();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="card w-full max-w-md space-y-4">
        <h3 className="text-lg font-semibold">Add Agent</h3>
        {error && <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm px-4 py-2 rounded-lg">{error}</div>}

        <div>
          <label className="block text-sm text-gray-400 mb-1">Name</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" required />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Email</label>
          <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input" required />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Password</label>
          <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="input" required minLength={6} />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Role</label>
          <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="input">
            <option value="agent">Agent</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? 'Creating...' : 'Create Agent'}
          </button>
        </div>
      </form>
    </div>
  );
}
