import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { dialer as dialerApi, campaigns as campaignsApi, agents as agentsApi } from '../services/api';
import { Phone, PhoneOff, Users, TrendingUp, Zap, Clock, BarChart3 } from 'lucide-react';

export default function DashboardPage() {
  const { agent, activeCampaignId, setActiveCampaignId, agentStatus } = useStore();
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState(null);
  const [agentList, setAgentList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadStats, 3000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    const [c, a] = await Promise.all([campaignsApi.list(), agentsApi.list()]);
    setCampaigns(c);
    setAgentList(a);
    setLoading(false);
    loadStats();
  }

  async function loadStats() {
    try {
      const s = await dialerApi.stats();
      setStats(s);
    } catch {}
  }

  async function handleStartCampaign(id) {
    await dialerApi.startCampaign(id);
    setActiveCampaignId(id);
    loadData();
  }

  async function handleStopCampaign(id) {
    await dialerApi.stopCampaign(id);
    loadData();
  }

  if (loading) return <div className="text-gray-500">Loading...</div>;

  const activeCampaignStats = stats?.campaigns?.[activeCampaignId];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Dialer Dashboard</h2>
        {stats && (
          <div className="flex items-center gap-4 text-sm">
            <span className="badge badge-green">{stats.activeCampaigns} Active Campaigns</span>
            <span className="badge badge-blue">{stats.pendingCalls} Live Calls</span>
            <span className="badge badge-yellow">{stats.queuedCalls} Queued</span>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={Phone} label="Active Calls" value={stats?.pendingCalls || 0} color="blue" />
        <StatCard icon={Users} label="Agents Available" value={agentList.filter(a => a.liveStatus === 'available').length} color="green" />
        <StatCard icon={Clock} label="Queued Calls" value={stats?.queuedCalls || 0} color="yellow" />
        <StatCard icon={TrendingUp} label="Active Campaigns" value={stats?.activeCampaigns || 0} color="purple" />
      </div>

      {/* Campaign Selector */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Campaign Control</h3>
        {campaigns.length === 0 ? (
          <p className="text-gray-500">No campaigns yet. Create one in the Campaigns tab.</p>
        ) : (
          <div className="space-y-3">
            {campaigns.map(c => {
              const isActive = c.status === 'active';
              const campaignStats = stats?.campaigns?.[c.id];
              return (
                <div key={c.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-gray-500">
                        {c.dial_mode} · ratio {c.dial_ratio} · {c.total_leads || 0} leads · {c.dialed_leads || 0} dialed
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {campaignStats && (
                      <span className="text-xs text-gray-400">
                        {campaignStats.activeCalls} calls · {campaignStats.availableAgents} agents
                      </span>
                    )}
                    {isActive ? (
                      <button onClick={() => handleStopCampaign(c.id)} className="btn-danger text-sm py-1.5">
                        <PhoneOff size={14} className="inline mr-1" /> Stop
                      </button>
                    ) : (
                      <button onClick={() => handleStartCampaign(c.id)} className="btn-primary text-sm py-1.5">
                        <Zap size={14} className="inline mr-1" /> Start
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Agent Status Board */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Agent Status Board</h3>
        <div className="grid grid-cols-2 gap-3">
          {agentList.map(a => (
            <div key={a.id} className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-3">
              <div className={`w-3 h-3 rounded-full ${
                a.liveStatus === 'available' ? 'bg-green-400' :
                a.liveStatus === 'on_call' ? 'bg-blue-400 animate-pulse' :
                a.liveStatus === 'wrap_up' ? 'bg-yellow-400' :
                a.liveStatus === 'paused' ? 'bg-orange-400' : 'bg-gray-600'
              }`} />
              <div>
                <p className="text-sm font-medium">{a.name}</p>
                <p className="text-xs text-gray-500 capitalize">{a.liveStatus}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    blue: 'text-blue-400 bg-blue-900/30',
    green: 'text-green-400 bg-green-900/30',
    yellow: 'text-yellow-400 bg-yellow-900/30',
    purple: 'text-purple-400 bg-purple-900/30'
  };

  return (
    <div className="card flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}
