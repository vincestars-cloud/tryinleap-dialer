const API_BASE = '/api';

function getHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: getHeaders(),
    ...options
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('agent');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Auth
export const auth = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) })
};

// Agents
export const agents = {
  list: () => request('/agents'),
  me: () => request('/agents/me'),
  goAvailable: (campaignId) => request('/agents/go-available', { method: 'POST', body: JSON.stringify({ campaignId }) }),
  goOffline: () => request('/agents/go-offline', { method: 'POST' }),
  pause: () => request('/agents/pause', { method: 'POST' }),
  disposition: (data) => request('/agents/disposition', { method: 'POST', body: JSON.stringify(data) })
};

// Dialer
export const dialer = {
  startCampaign: (id) => request(`/dialer/campaign/${id}/start`, { method: 'POST' }),
  stopCampaign: (id) => request(`/dialer/campaign/${id}/stop`, { method: 'POST' }),
  stats: () => request('/dialer/stats'),
  manualCall: (data) => request('/dialer/manual-call', { method: 'POST', body: JSON.stringify(data) }),
  hangup: (callControlId) => request(`/dialer/call/${callControlId}/hangup`, { method: 'POST' }),
  startRecording: (callControlId) => request(`/dialer/call/${callControlId}/record/start`, { method: 'POST' }),
  stopRecording: (callControlId) => request(`/dialer/call/${callControlId}/record/stop`, { method: 'POST' })
};

// Campaigns
export const campaigns = {
  list: () => request('/campaigns'),
  get: (id) => request(`/campaigns/${id}`),
  create: (data) => request('/campaigns', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/campaigns/${id}`, { method: 'DELETE' }),
  assignAgents: (id, agentIds) => request(`/campaigns/${id}/agents`, { method: 'POST', body: JSON.stringify({ agentIds }) }),
  dispositions: (id) => request(`/campaigns/${id}/dispositions`)
};

// Leads
export const leads = {
  list: (params) => request(`/leads?${new URLSearchParams(params)}`),
  get: (id) => request(`/leads/${id}`),
  create: (data) => request('/leads', { method: 'POST', body: JSON.stringify(data) }),
  bulkImport: (leadsData) => request('/leads/bulk', { method: 'POST', body: JSON.stringify({ leads: leadsData }) }),
  uploadCSV: async (file, campaignId) => {
    const formData = new FormData();
    formData.append('file', file);
    if (campaignId) formData.append('campaign_id', campaignId);
    const token = localStorage.getItem('token');
    const res = await fetch('/api/leads/upload-csv', {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Upload failed');
    return res.json();
  },
  update: (id, data) => request(`/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/leads/${id}`, { method: 'DELETE' }),
  addNote: (id, content, callId) => request(`/leads/${id}/notes`, { method: 'POST', body: JSON.stringify({ content, callId }) })
};

// SMS
export const sms = {
  send: (data) => request('/sms/send', { method: 'POST', body: JSON.stringify(data) }),
  conversation: (leadId) => request(`/sms/conversation/${leadId}`),
  history: (params) => request(`/sms/history?${new URLSearchParams(params)}`)
};

// Recordings
export const recordings = {
  list: (params) => request(`/recordings?${new URLSearchParams(params)}`)
};

// WebRTC
export const webrtc = {
  credentials: () => request('/webrtc/credentials'),
  token: () => request('/webrtc/token')
};

// Callbacks
export const callbacks = {
  list: (params) => request(`/callbacks?${new URLSearchParams(params || {})}`),
  create: (data) => request('/callbacks', { method: 'POST', body: JSON.stringify(data) }),
  complete: (id) => request(`/callbacks/${id}/complete`, { method: 'PUT' }),
  delete: (id) => request(`/callbacks/${id}`, { method: 'DELETE' })
};

// Scripts
export const scripts = {
  list: (campaignId) => request(`/scripts?campaign_id=${campaignId}`),
  create: (data) => request('/scripts', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/scripts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/scripts/${id}`, { method: 'DELETE' })
};

// Transfers
export const transfers = {
  cold: (data) => request('/transfers/cold', { method: 'POST', body: JSON.stringify(data) }),
  warm: (data) => request('/transfers/warm', { method: 'POST', body: JSON.stringify(data) }),
  completeWarm: (data) => request('/transfers/complete-warm', { method: 'POST', body: JSON.stringify(data) })
};

// Monitor (supervisor)
export const monitor = {
  listen: (data) => request('/monitor/listen', { method: 'POST', body: JSON.stringify(data) }),
  whisper: (data) => request('/monitor/whisper', { method: 'POST', body: JSON.stringify(data) }),
  barge: (data) => request('/monitor/barge', { method: 'POST', body: JSON.stringify(data) }),
  stop: (sessionId) => request('/monitor/stop', { method: 'POST', body: JSON.stringify({ sessionId }) }),
  active: () => request('/monitor/active')
};

// Reporting
export const reporting = {
  overview: (params) => request(`/reporting/overview?${new URLSearchParams(params || {})}`),
  agentPerformance: (params) => request(`/reporting/agent-performance?${new URLSearchParams(params || {})}`),
  hourly: (params) => request(`/reporting/hourly?${new URLSearchParams(params || {})}`),
  campaignSummary: () => request('/reporting/campaign-summary')
};
