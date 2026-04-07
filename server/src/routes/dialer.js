import { Router } from 'express';
import { startRecording, stopRecording, hangupCall } from '../services/telnyx.js';

const router = Router();

// POST /api/dialer/campaign/:id/start
router.post('/campaign/:id/start', async (req, res) => {
  try {
    const dialerEngine = req.app.get('dialerEngine');
    await dialerEngine.startCampaign(req.params.id);
    res.json({ success: true, message: 'Campaign started' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dialer/campaign/:id/stop
router.post('/campaign/:id/stop', async (req, res) => {
  try {
    const dialerEngine = req.app.get('dialerEngine');
    await dialerEngine.stopCampaign(req.params.id);
    res.json({ success: true, message: 'Campaign stopped' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dialer/stats
router.get('/stats', (req, res) => {
  const dialerEngine = req.app.get('dialerEngine');
  res.json(dialerEngine.getStats());
});

// GET /api/dialer/diagnostics
router.get('/diagnostics', (req, res) => {
  const dialerEngine = req.app.get('dialerEngine');
  res.json(dialerEngine.getDiagnostics());
});

// POST /api/dialer/manual-call — place a single outbound call to a specific lead
router.post('/manual-call', async (req, res) => {
  const { leadId, phone } = req.body;
  const dialerEngine = req.app.get('dialerEngine');
  const agentManager = req.app.get('agentManager');

  try {
    // Get lead info
    let lead, callerId = process.env.TELNYX_PHONE_NUMBER;
    if (leadId) {
      const { data } = await (await import('../services/supabase.js')).supabase
        .from('leads').select('*').eq('id', leadId).single();
      lead = data;
    }

    const toNumber = lead?.phone || phone;
    if (!toNumber) return res.status(400).json({ error: 'No phone number provided' });

    // Get local caller ID
    const { getLocalCallerId } = await import('../services/localPresence.js');
    callerId = await getLocalCallerId(toNumber, callerId);

    // Create call record
    const { supabase } = await import('../services/supabase.js');
    const { data: callRecord } = await supabase
      .from('calls')
      .insert({
        campaign_id: lead?.campaign_id || null,
        lead_id: leadId || null,
        agent_id: req.agent.id,
        direction: 'outbound',
        from_number: callerId,
        to_number: toNumber,
        status: 'initiated'
      })
      .select().single();

    // Place call via Telnyx
    const { makeOutboundCall } = await import('../services/telnyx.js');
    const clientState = { callId: callRecord.id, leadId: leadId || null, campaignId: lead?.campaign_id || null, manual: true };
    const telnyxCall = await makeOutboundCall({ to: toNumber, from: callerId, clientState });

    // Update call with Telnyx IDs
    await supabase.from('calls').update({
      telnyx_call_control_id: telnyxCall.call_control_id,
      telnyx_call_leg_id: telnyxCall.call_leg_id
    }).eq('id', callRecord.id);

    // Track in dialer engine
    dialerEngine.pendingCalls.set(telnyxCall.call_control_id, {
      callId: callRecord.id,
      leadId: leadId || null,
      campaignId: lead?.campaign_id || null,
      telnyxCallControlId: telnyxCall.call_control_id,
      telnyxCallLegId: telnyxCall.call_leg_id,
      agentId: req.agent.id,
      status: 'initiated'
    });

    // Mark agent as on_call
    await agentManager.assignCallToAgent(req.agent.id, callRecord.id);

    // Update lead attempts
    if (leadId) {
      await supabase.from('leads').update({
        attempts: (lead?.attempts || 0) + 1,
        last_attempt_at: new Date().toISOString()
      }).eq('id', leadId);
    }

    // Send call info to agent via WebSocket
    const wsManager = req.app.get('wsManager');
    wsManager.sendToAgent(req.agent.id, {
      type: 'incoming_call',
      callId: callRecord.id,
      callControlId: telnyxCall.call_control_id,
      lead: lead || { phone: toNumber },
      campaignId: lead?.campaign_id || null,
      manual: true
    });

    res.json({
      success: true,
      callId: callRecord.id,
      callControlId: telnyxCall.call_control_id
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dialer/call/:callControlId/hangup
router.post('/call/:callControlId/hangup', async (req, res) => {
  try {
    await hangupCall(req.params.callControlId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dialer/call/:callControlId/record/start
router.post('/call/:callControlId/record/start', async (req, res) => {
  try {
    await startRecording(req.params.callControlId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dialer/call/:callControlId/record/stop
router.post('/call/:callControlId/record/stop', async (req, res) => {
  try {
    await stopRecording(req.params.callControlId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { router as dialerRouter };
