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

// POST /api/dialer/manual-call — prepare a manual call (returns info for WebRTC leg)
router.post('/manual-call', async (req, res) => {
  const { leadId, phone } = req.body;

  try {
    const { supabase } = await import('../services/supabase.js');
    const { getLocalCallerId } = await import('../services/localPresence.js');

    // Get lead info
    let lead, callerId = process.env.TELNYX_PHONE_NUMBER;
    if (leadId) {
      const { data } = await supabase.from('leads').select('*').eq('id', leadId).single();
      lead = data;
    }

    const toNumber = lead?.phone || phone;
    if (!toNumber) return res.status(400).json({ error: 'No phone number provided' });

    callerId = await getLocalCallerId(toNumber, callerId);

    // Create call record
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
    // Update lead attempts
    if (leadId) {
      await supabase.from('leads').update({
        attempts: (lead?.attempts || 0) + 1,
        last_attempt_at: new Date().toISOString()
      }).eq('id', leadId);
    }

    // DON'T dial PSTN from server — the browser WebRTC client will do it
    // This gives us two-way audio through the browser
    res.json({
      success: true,
      callId: callRecord.id,
      leadPhone: toNumber,
      callerId,
      lead: lead || { phone: toNumber }
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
