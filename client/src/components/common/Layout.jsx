import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { Phone, Users, BarChart3, MessageSquare, Mic, Shield, LogOut, Zap, Calendar, TrendingUp } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { wsService } from '../../services/websocket';
import { webrtc as webrtcApi } from '../../services/api';
import AgentStatusBar from '../dashboard/AgentStatusBar';
import ActiveCallBar from '../softphone/ActiveCallBar';
import Notifications from './Notifications';

const navItems = [
  { to: '/', icon: Phone, label: 'Dialer' },
  { to: '/leads', icon: Users, label: 'Leads' },
  { to: '/campaigns', icon: Zap, label: 'Campaigns' },
  { to: '/sms', icon: MessageSquare, label: 'SMS' },
  { to: '/recordings', icon: Mic, label: 'Recordings' },
  { to: '/callbacks', icon: Calendar, label: 'Callbacks' },
  { to: '/reporting', icon: TrendingUp, label: 'Reporting' },
  { to: '/admin', icon: Shield, label: 'Admin' }
];

export default function Layout() {
  const { agent, logout, setActiveCall, setAgentStatus, addNotification, setWsConnected, setDialerStats, updateAgentInList, sipCredentials, setSipCredentials, setWebrtcMakeCall, setWebrtcStatus } = useStore();
  const navigate = useNavigate();
  const audioRef = useRef(null);
  const webrtcRef = useRef(null);

  // Initialize WebRTC when SIP credentials are available
  useEffect(() => {
    if (!sipCredentials) return;

    async function initWebRTC() {
      try {
        const { TelnyxRTC } = await import('@telnyx/webrtc');
        const client = new TelnyxRTC({
          login: sipCredentials.login,
          password: sipCredentials.password
        });

        client.on('telnyx.ready', () => {
          console.log('WebRTC: Ready');
          setWebrtcStatus('ready');
          setWebrtcMakeCall(() => (destinationNumber, callerNumber, callerName, clientState) => {
            const call = client.newCall({
              destinationNumber,
              callerNumber: callerNumber || '',
              callerName: callerName || 'TryInLeap',
              audio: true,
              video: false,
              customHeaders: clientState ? [{ name: 'X-Client-State', value: btoa(JSON.stringify(clientState)) }] : undefined
            });
            return call;
          });
        });

        client.on('telnyx.error', (err) => {
          console.error('WebRTC error:', err);
          setWebrtcStatus('error');
        });

        client.on('telnyx.notification', (notification) => {
          const call = notification.call;
          if (!call) return;
          if (notification.type === 'callUpdate') {
            console.log('WebRTC call state:', call.state);
            if (call.state === 'active') {
              const remoteAudio = document.getElementById('remote-audio');
              if (remoteAudio && call.remoteStream) {
                remoteAudio.srcObject = call.remoteStream;
              }
            }
            if (call.state === 'hangup' || call.state === 'destroy') {
              const remoteAudio = document.getElementById('remote-audio');
              if (remoteAudio) remoteAudio.srcObject = null;
            }
          }
        });

        client.connect();
        webrtcRef.current = client;

        // Request microphone permission
        await navigator.mediaDevices.getUserMedia({ audio: true }).catch(e => {
          console.error('Mic permission denied:', e);
          addNotification({ type: 'error', message: 'Microphone access denied. Please allow microphone in browser settings.' });
        });

      } catch (e) {
        console.error('WebRTC init failed:', e);
      }
    }

    initWebRTC();
    return () => {
      if (webrtcRef.current) {
        webrtcRef.current.disconnect();
        webrtcRef.current = null;
      }
    };
  }, [sipCredentials]);

  // Fetch SIP credentials on mount
  useEffect(() => {
    if (!agent) return;
    webrtcApi.credentials().then(creds => {
      setSipCredentials(creds);
      console.log('SIP credentials loaded:', creds.login);
    }).catch(err => {
      console.log('SIP credentials not available yet:', err.message);
    });
  }, [agent?.id]);

  useEffect(() => {
    if (!agent) return;

    wsService.connect(agent.id);

    const unsubs = [
      wsService.on('connected', () => setWsConnected(true)),
      wsService.on('disconnected', () => setWsConnected(false)),

      wsService.on('incoming_call', (data) => {
        setActiveCall({
          callId: data.callId,
          callControlId: data.callControlId,
          lead: data.lead,
          campaignId: data.campaignId
        });
        setAgentStatus('on_call');
        addNotification({ type: 'info', message: `Incoming call: ${data.lead?.first_name} ${data.lead?.last_name}` });
      }),

      wsService.on('call_ended', (data) => {
        setAgentStatus('wrap_up');
        addNotification({ type: 'info', message: 'Call ended — disposition required' });
      }),

      wsService.on('agent_status_changed', (data) => {
        if (data.agentId === agent.id) {
          setAgentStatus(data.status);
        }
        updateAgentInList(data.agentId, { liveStatus: data.status });
      }),

      wsService.on('campaign_started', () => {
        addNotification({ type: 'success', message: 'Campaign started' });
      }),

      wsService.on('campaign_stopped', () => {
        addNotification({ type: 'warning', message: 'Campaign stopped' });
      })
    ];

    return () => {
      unsubs.forEach(u => u());
      wsService.disconnect();
    };
  }, [agent?.id]);

  const handleLogout = () => {
    wsService.disconnect();
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen">
      {/* Hidden audio element for WebRTC call audio */}
      <audio ref={audioRef} id="remote-audio" autoPlay />
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-xl font-bold text-leap-400">TryInLeap</h1>
          <p className="text-xs text-gray-500 mt-1">Predictive Dialer</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-leap-600/20 text-leap-400'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-leap-600 flex items-center justify-center text-sm font-bold">
              {agent?.name?.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{agent?.name}</p>
              <p className="text-xs text-gray-500">{agent?.role}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-400 transition-colors w-full">
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <AgentStatusBar />
        <ActiveCallBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      <Notifications />
    </div>
  );
}
