import { supabase } from './supabase.js';
import { makeOutboundCall, hangupCall, createConference, joinConference, playAudio } from './telnyx.js';
import { getLocalCallerId } from './localPresence.js';
import { v4 as uuidv4 } from 'uuid';

export class DialerEngine {
  constructor(agentManager, wsManager) {
    this.agentManager = agentManager;
    this.wsManager = wsManager;

    // Active calls waiting for AMD result or agent assignment
    this.pendingCalls = new Map();
    // Active campaigns being dialed
    this.activeCampaigns = new Map();
    // Calls waiting for an agent
    this.callQueue = [];
    // Recent errors for diagnostics
    this.recentErrors = [];
    this.recentActivity = [];
  }

  // ─── Campaign Control ───────────────────────────────

  async startCampaign(campaignId) {
    if (this.activeCampaigns.has(campaignId)) return;

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (!campaign) throw new Error('Campaign not found');

    await supabase.from('campaigns').update({ status: 'active' }).eq('id', campaignId);

    const config = {
      ...campaign,
      intervalId: setInterval(() => this.dialingLoop(campaignId), 2000) // Check every 2s
    };
    this.activeCampaigns.set(campaignId, config);

    this.wsManager.broadcast({ type: 'campaign_started', campaignId });
    console.log(`Campaign ${campaign.name} started in ${campaign.dial_mode} mode`);
  }

  async stopCampaign(campaignId) {
    const config = this.activeCampaigns.get(campaignId);
    if (config) {
      clearInterval(config.intervalId);
      this.activeCampaigns.delete(campaignId);
    }

    await supabase.from('campaigns').update({ status: 'paused' }).eq('id', campaignId);
    this.wsManager.broadcast({ type: 'campaign_stopped', campaignId });
    console.log(`Campaign ${campaignId} stopped`);
  }

  // ─── Core Dialing Loop ──────────────────────────────

  async dialingLoop(campaignId) {
    const config = this.activeCampaigns.get(campaignId);
    if (!config) return;

    const availableAgents = this.agentManager.getAvailableAgentCount(campaignId);
    if (availableAgents === 0) return;

    // Count calls currently in progress for this campaign
    const activeCalls = this.getActiveCampaignCallCount(campaignId);

    let callsToMake = 0;

    if (config.dial_mode === 'predictive') {
      // Predictive: dial at a ratio above available agents
      // ratio of 2.0 means 2 outbound calls per available agent
      const targetCalls = Math.ceil(availableAgents * config.dial_ratio);
      callsToMake = Math.max(0, targetCalls - activeCalls);
    } else {
      // Progressive: 1:1 ratio — one call per available agent
      callsToMake = Math.max(0, availableAgents - activeCalls);
    }

    if (callsToMake === 0) return;

    // Fetch leads to dial
    const leads = await this.getNextLeads(campaignId, callsToMake);

    this.logActivity(`Dialing ${leads.length} leads for campaign ${config.name} (${callsToMake} needed, ${availableAgents} agents, ${activeCalls} active)`);

    for (const lead of leads) {
      try {
        await this.placeCall(lead, config);
        this.logActivity(`Placed call to ${lead.phone} (${lead.first_name} ${lead.last_name})`);
      } catch (err) {
        this.logError(`Failed to dial ${lead.phone}: ${err.message}`);
        console.error(`Failed to dial ${lead.phone}:`, err.message);
      }
    }
  }

  async getNextLeads(campaignId, count) {
    // Get leads that haven't exceeded max attempts, aren't DNC, ordered by priority
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('max_attempts, retry_delay_minutes')
      .eq('id', campaignId)
      .single();

    const retryAfter = new Date(Date.now() - (campaign.retry_delay_minutes || 60) * 60000).toISOString();

    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .eq('campaign_id', campaignId)
      .in('status', ['new', 'contacted'])
      .eq('is_dnc', false)
      .lt('attempts', campaign.max_attempts)
      .or(`last_attempt_at.is.null,last_attempt_at.lt.${retryAfter}`)
      .order('priority', { ascending: false })
      .order('attempts', { ascending: true })
      .limit(count);

    return leads || [];
  }

  async placeCall(lead, campaignConfig) {
    // Get local caller ID matching lead's area code
    const callerId = await getLocalCallerId(lead.phone, campaignConfig.caller_id);

    // Create call record in DB
    const { data: callRecord } = await supabase
      .from('calls')
      .insert({
        campaign_id: campaignConfig.id,
        lead_id: lead.id,
        direction: 'outbound',
        from_number: callerId,
        to_number: lead.phone,
        status: 'initiated'
      })
      .select()
      .single();

    // Place call via Telnyx
    const clientState = {
      callId: callRecord.id,
      leadId: lead.id,
      campaignId: campaignConfig.id
    };

    const telnyxCall = await makeOutboundCall({
      to: lead.phone,
      from: campaignConfig.caller_id,
      clientState
    });

    // Track this call
    this.pendingCalls.set(telnyxCall.call_control_id, {
      callId: callRecord.id,
      leadId: lead.id,
      campaignId: campaignConfig.id,
      telnyxCallControlId: telnyxCall.call_control_id,
      telnyxCallLegId: telnyxCall.call_leg_id,
      status: 'initiated'
    });

    // Update call record with Telnyx IDs
    await supabase
      .from('calls')
      .update({
        telnyx_call_control_id: telnyxCall.call_control_id,
        telnyx_call_leg_id: telnyxCall.call_leg_id
      })
      .eq('id', callRecord.id);

    // Update lead attempt count
    await supabase
      .from('leads')
      .update({
        attempts: lead.attempts + 1,
        last_attempt_at: new Date().toISOString()
      })
      .eq('id', lead.id);

    this.wsManager.broadcast({
      type: 'call_initiated',
      callId: callRecord.id,
      leadId: lead.id,
      phone: lead.phone,
      campaignId: campaignConfig.id
    });

    console.log(`Dialing ${lead.phone} (Lead: ${lead.first_name} ${lead.last_name})`);
  }

  // ─── Webhook Event Handlers ─────────────────────────

  async handleCallAnswered(callControlId, event) {
    const pending = this.pendingCalls.get(callControlId);
    if (!pending) return;

    pending.status = 'answered';

    await supabase
      .from('calls')
      .update({ status: 'answered', answered_at: new Date().toISOString() })
      .eq('id', pending.callId);

    this.wsManager.broadcast({
      type: 'call_answered',
      callId: pending.callId,
      leadId: pending.leadId
    });

    // AMD will fire separately — don't bridge yet
    console.log(`Call answered: ${callControlId}`);
  }

  async handleAMDResult(callControlId, event) {
    const pending = this.pendingCalls.get(callControlId);
    if (!pending) return;

    const result = event.payload?.result;
    pending.amdResult = result;

    await supabase
      .from('calls')
      .update({ amd_result: result })
      .eq('id', pending.callId);

    console.log(`AMD result for ${callControlId}: ${result}`);

    if (result === 'human_residence' || result === 'human_business' || result === 'human') {
      // Human answered — try to bridge to an available agent
      await this.bridgeToAgent(callControlId, pending);
    } else if (result === 'machine') {
      // Machine — optionally drop voicemail, then hang up
      const config = this.activeCampaigns.get(pending.campaignId);
      if (config?.voicemail_drop_url) {
        // Wait for greeting to end, then play voicemail
        pending.status = 'voicemail_pending';
      } else {
        await this.endCall(callControlId, 'machine');
      }
    } else {
      // fax, silence, not_sure — hang up
      await this.endCall(callControlId, result);
    }
  }

  async handleGreetingEnded(callControlId) {
    const pending = this.pendingCalls.get(callControlId);
    if (!pending || pending.status !== 'voicemail_pending') return;

    const config = this.activeCampaigns.get(pending.campaignId);
    if (config?.voicemail_drop_url) {
      try {
        await playAudio(callControlId, config.voicemail_drop_url);
        // Call will be hung up after audio finishes, or after a timeout
        setTimeout(() => this.endCall(callControlId, 'machine'), 30000);
      } catch (err) {
        console.error('Voicemail drop failed:', err.message);
        await this.endCall(callControlId, 'machine');
      }
    }
  }

  async bridgeToAgent(callControlId, pending) {
    const availableAgents = this.agentManager.getAvailableAgents(pending.campaignId);

    if (availableAgents.length === 0) {
      // No agent available — queue the call
      this.callQueue.push({
        callControlId,
        callId: pending.callId,
        leadId: pending.leadId,
        campaignId: pending.campaignId,
        answeredAt: Date.now()
      });
      console.log(`No agents available, queuing call ${callControlId}`);

      // Abandon call after 30 seconds if no agent
      setTimeout(() => {
        const idx = this.callQueue.findIndex(c => c.callControlId === callControlId);
        if (idx !== -1) {
          this.callQueue.splice(idx, 1);
          this.endCall(callControlId, 'no_answer');
        }
      }, 30000);
      return;
    }

    const agentId = availableAgents[0];
    await this.connectCallToAgent(callControlId, pending, agentId);
  }

  async connectCallToAgent(callControlId, pending, agentId) {
    // Get lead info for agent screen pop
    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', pending.leadId)
      .single();

    // Mark agent as on-call
    await this.agentManager.assignCallToAgent(agentId, pending.callId);

    // Update call record with agent
    await supabase
      .from('calls')
      .update({ agent_id: agentId, status: 'bridged' })
      .eq('id', pending.callId);

    pending.agentId = agentId;
    pending.status = 'bridged';

    // Send screen pop to agent
    this.wsManager.sendToAgent(agentId, {
      type: 'incoming_call',
      callId: pending.callId,
      callControlId,
      lead,
      campaignId: pending.campaignId
    });

    this.wsManager.broadcast({
      type: 'call_bridged',
      callId: pending.callId,
      agentId,
      leadId: pending.leadId
    });

    console.log(`Bridging call ${callControlId} to agent ${agentId}`);
  }

  async handleCallEnded(callControlId, event) {
    const pending = this.pendingCalls.get(callControlId);
    if (!pending) return;

    const duration = event.payload?.duration_secs || 0;

    await supabase
      .from('calls')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        duration_seconds: duration
      })
      .eq('id', pending.callId);

    // If agent was on this call, put them in wrap-up
    if (pending.agentId) {
      await this.agentManager.setAgentStatus(pending.agentId, 'wrap_up');

      this.wsManager.sendToAgent(pending.agentId, {
        type: 'call_ended',
        callId: pending.callId,
        leadId: pending.leadId,
        duration
      });
    }

    this.pendingCalls.delete(callControlId);

    this.wsManager.broadcast({
      type: 'call_completed',
      callId: pending.callId,
      duration
    });

    // Check if there are queued calls and available agents
    this.processCallQueue();
  }

  async handleRecordingReady(event) {
    const callControlId = event.payload?.call_control_id;
    const recordingUrl = event.payload?.recording_urls?.mp3;

    if (callControlId && recordingUrl) {
      await supabase
        .from('calls')
        .update({ recording_url: recordingUrl })
        .eq('telnyx_call_control_id', callControlId);
    }
  }

  // ─── Call Queue Processing ──────────────────────────

  async processCallQueue() {
    if (this.callQueue.length === 0) return;

    for (let i = this.callQueue.length - 1; i >= 0; i--) {
      const queued = this.callQueue[i];
      const agents = this.agentManager.getAvailableAgents(queued.campaignId);

      if (agents.length > 0) {
        this.callQueue.splice(i, 1);
        const pending = this.pendingCalls.get(queued.callControlId);
        if (pending) {
          await this.connectCallToAgent(queued.callControlId, pending, agents[0]);
        }
      }
    }
  }

  // ─── Helpers ────────────────────────────────────────

  async endCall(callControlId, reason) {
    try {
      await hangupCall(callControlId);
    } catch (err) {
      // Call may already be ended
    }

    const pending = this.pendingCalls.get(callControlId);
    if (pending) {
      await supabase
        .from('calls')
        .update({
          status: reason === 'machine' ? 'machine' : reason === 'busy' ? 'busy' : 'no_answer',
          ended_at: new Date().toISOString()
        })
        .eq('id', pending.callId);

      this.pendingCalls.delete(callControlId);
    }
  }

  getActiveCampaignCallCount(campaignId) {
    let count = 0;
    for (const [, call] of this.pendingCalls) {
      if (call.campaignId === campaignId && call.status !== 'completed') {
        count++;
      }
    }
    return count;
  }

  getStats() {
    const stats = {
      activeCampaigns: this.activeCampaigns.size,
      pendingCalls: this.pendingCalls.size,
      queuedCalls: this.callQueue.length,
      campaigns: {}
    };

    for (const [campaignId, config] of this.activeCampaigns) {
      stats.campaigns[campaignId] = {
        name: config.name,
        mode: config.dial_mode,
        ratio: config.dial_ratio,
        activeCalls: this.getActiveCampaignCallCount(campaignId),
        availableAgents: this.agentManager.getAvailableAgentCount(campaignId)
      };
    }

    return stats;
  }

  logError(msg) {
    this.recentErrors.unshift({ time: new Date().toISOString(), message: msg });
    if (this.recentErrors.length > 50) this.recentErrors.pop();
  }

  logActivity(msg) {
    this.recentActivity.unshift({ time: new Date().toISOString(), message: msg });
    if (this.recentActivity.length > 100) this.recentActivity.pop();
  }

  getDiagnostics() {
    return {
      errors: this.recentErrors.slice(0, 20),
      activity: this.recentActivity.slice(0, 30),
      agentStates: this.agentManager.getAllAgentStates(),
      activeCampaigns: Array.from(this.activeCampaigns.keys()),
      pendingCallCount: this.pendingCalls.size,
      queueLength: this.callQueue.length
    };
  }
}
