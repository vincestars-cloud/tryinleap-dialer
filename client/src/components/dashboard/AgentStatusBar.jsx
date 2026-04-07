import { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { agents as agentsApi, campaigns as campaignsApi } from '../../services/api';
import { Wifi, WifiOff, Circle } from 'lucide-react';

const statusColors = {
  offline: 'text-gray-500',
  available: 'text-green-400',
  on_call: 'text-blue-400',
  wrap_up: 'text-yellow-400',
  paused: 'text-orange-400'
};

const statusLabels = {
  offline: 'Offline',
  available: 'Available',
  on_call: 'On Call',
  wrap_up: 'Wrap Up',
  paused: 'Paused'
};

export default function AgentStatusBar() {
  const { agentStatus, wsConnected, activeCampaignId, setActiveCampaignId } = useStore();
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(activeCampaignId || '');

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    if (activeCampaignId) setSelectedCampaign(activeCampaignId);
  }, [activeCampaignId]);

  async function loadCampaigns() {
    const data = await campaignsApi.list();
    setCampaigns(data || []);
    // Auto-select the first active campaign if none selected
    if (!activeCampaignId && data.length > 0) {
      const active = data.find(c => c.status === 'active') || data[0];
      setSelectedCampaign(active.id);
    }
  }

  const handleGoAvailable = async () => {
    const campId = selectedCampaign || activeCampaignId;
    if (campId) setActiveCampaignId(campId);
    await agentsApi.goAvailable(campId);
  };

  const handlePause = async () => {
    await agentsApi.pause();
  };

  const handleGoOffline = async () => {
    await agentsApi.goOffline();
  };

  return (
    <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {wsConnected ? <Wifi size={16} className="text-green-400" /> : <WifiOff size={16} className="text-red-400" />}
          <span className="text-xs text-gray-500">{wsConnected ? 'Connected' : 'Disconnected'}</span>
        </div>

        <div className="flex items-center gap-2">
          <Circle size={10} fill="currentColor" className={statusColors[agentStatus]} />
          <span className={`text-sm font-medium ${statusColors[agentStatus]}`}>
            {statusLabels[agentStatus]}
          </span>
        </div>

        {/* Campaign selector - shown when offline or available */}
        {(agentStatus === 'offline' || agentStatus === 'paused') && campaigns.length > 0 && (
          <select
            value={selectedCampaign}
            onChange={e => setSelectedCampaign(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-leap-500"
          >
            <option value="">Select Campaign</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
            ))}
          </select>
        )}

        {agentStatus === 'available' && selectedCampaign && (
          <span className="text-xs text-gray-500">
            Campaign: {campaigns.find(c => c.id === selectedCampaign)?.name || '—'}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {agentStatus === 'offline' && (
          <button onClick={handleGoAvailable} disabled={!selectedCampaign} className="btn-primary text-sm py-1.5 disabled:opacity-50">
            Go Available
          </button>
        )}
        {agentStatus === 'available' && (
          <>
            <button onClick={handlePause} className="btn-secondary text-sm py-1.5">
              Pause
            </button>
            <button onClick={handleGoOffline} className="btn-danger text-sm py-1.5">
              Go Offline
            </button>
          </>
        )}
        {agentStatus === 'paused' && (
          <>
            <button onClick={handleGoAvailable} className="btn-primary text-sm py-1.5">
              Resume
            </button>
            <button onClick={handleGoOffline} className="btn-danger text-sm py-1.5">
              Go Offline
            </button>
          </>
        )}
      </div>
    </div>
  );
}
