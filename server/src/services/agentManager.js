import { supabase } from './supabase.js';

export class AgentManager {
  constructor(wsManager) {
    this.wsManager = wsManager;
    // In-memory agent state for fast access
    this.agentStates = new Map(); // agentId -> { status, currentCallId, campaignId, connectedAt }

    wsManager.onMessage((agentId, message) => {
      this.handleAgentMessage(agentId, message);
    });
  }

  async handleAgentMessage(agentId, message) {
    switch (message.type) {
      case 'status_change':
        await this.setAgentStatus(agentId, message.status);
        break;
      case 'wrap_up_complete':
        await this.setAgentStatus(agentId, 'available');
        break;
    }
  }

  async setAgentStatus(agentId, status) {
    const state = this.agentStates.get(agentId) || {};
    state.status = status;
    if (status === 'available') {
      state.currentCallId = null;
    }
    this.agentStates.set(agentId, state);

    // Persist to DB
    await supabase
      .from('agents')
      .update({ status })
      .eq('id', agentId);

    // Broadcast state change
    this.wsManager.broadcast({
      type: 'agent_status_changed',
      agentId,
      status
    });
  }

  async assignCallToAgent(agentId, callId) {
    const state = this.agentStates.get(agentId) || {};
    state.status = 'on_call';
    state.currentCallId = callId;
    this.agentStates.set(agentId, state);

    await supabase
      .from('agents')
      .update({ status: 'on_call' })
      .eq('id', agentId);

    this.wsManager.broadcast({
      type: 'agent_status_changed',
      agentId,
      status: 'on_call'
    });
  }

  getAvailableAgents(campaignId) {
    const available = [];
    for (const [agentId, state] of this.agentStates) {
      if (state.status === 'available') {
        if (!campaignId || state.campaignId === campaignId) {
          available.push(agentId);
        }
      }
    }
    return available;
  }

  getAvailableAgentCount(campaignId) {
    return this.getAvailableAgents(campaignId).length;
  }

  registerAgent(agentId, campaignId) {
    this.agentStates.set(agentId, {
      status: 'available',
      currentCallId: null,
      campaignId,
      connectedAt: new Date()
    });
  }

  unregisterAgent(agentId) {
    this.agentStates.delete(agentId);
  }

  getAgentState(agentId) {
    return this.agentStates.get(agentId);
  }

  getAllAgentStates() {
    const states = {};
    for (const [agentId, state] of this.agentStates) {
      states[agentId] = state;
    }
    return states;
  }
}
