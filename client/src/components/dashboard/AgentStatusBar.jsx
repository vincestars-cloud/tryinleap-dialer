import { useStore } from '../../store/useStore';
import { agents as agentsApi } from '../../services/api';
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
  const { agentStatus, wsConnected, activeCampaignId } = useStore();

  const handleGoAvailable = async () => {
    await agentsApi.goAvailable(activeCampaignId);
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
      </div>

      <div className="flex items-center gap-2">
        {agentStatus === 'offline' && (
          <button onClick={handleGoAvailable} className="btn-primary text-sm py-1.5">
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
