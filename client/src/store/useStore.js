import { create } from 'zustand';

export const useStore = create((set, get) => ({
  // Auth
  agent: JSON.parse(localStorage.getItem('agent') || 'null'),
  token: localStorage.getItem('token'),
  setAuth: (agent, token) => {
    localStorage.setItem('agent', JSON.stringify(agent));
    localStorage.setItem('token', token);
    set({ agent, token });
  },
  logout: () => {
    localStorage.removeItem('agent');
    localStorage.removeItem('token');
    set({ agent: null, token: null });
  },

  // Agent status
  agentStatus: 'offline',
  setAgentStatus: (status) => set({ agentStatus: status }),

  // Active call
  activeCall: null, // { callId, callControlId, lead, campaignId }
  setActiveCall: (call) => set({ activeCall: call }),
  clearActiveCall: () => set({ activeCall: null }),

  // Dialer stats
  dialerStats: null,
  setDialerStats: (stats) => set({ dialerStats: stats }),

  // Agent list (for admin)
  agentList: [],
  setAgentList: (list) => set({ agentList: list }),
  updateAgentInList: (agentId, updates) => {
    const list = get().agentList.map(a =>
      a.id === agentId ? { ...a, ...updates } : a
    );
    set({ agentList: list });
  },

  // Notifications
  notifications: [],
  addNotification: (notification) => {
    const id = Date.now();
    set({ notifications: [...get().notifications, { ...notification, id }] });
    setTimeout(() => {
      set({ notifications: get().notifications.filter(n => n.id !== id) });
    }, 5000);
  },

  // Active campaign
  activeCampaignId: null,
  setActiveCampaignId: (id) => set({ activeCampaignId: id }),

  // WebSocket connected
  wsConnected: false,
  setWsConnected: (val) => set({ wsConnected: val }),

  // WebRTC
  webrtcMakeCall: null, // function to make a WebRTC call
  webrtcStatus: 'disconnected',
  setWebrtcMakeCall: (fn) => set({ webrtcMakeCall: fn }),
  setWebrtcStatus: (status) => set({ webrtcStatus: status }),

  // SIP credentials
  sipCredentials: null,
  setSipCredentials: (creds) => set({ sipCredentials: creds })
}));
