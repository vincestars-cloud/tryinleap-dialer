import { Router } from 'express';
import { supabase } from '../services/supabase.js';
import { transferCall, bridgeCall, hangupCall } from '../services/telnyx.js';

const router = Router();

// POST /api/transfers/cold — cold transfer (disconnect agent, connect to target)
router.post('/cold', async (req, res) => {
  const { callControlId, callId, toNumber, toAgentId } = req.body;

  try {
    // Transfer the call to the target number
    await transferCall(callControlId, toNumber || '');

    // Log the transfer
    await supabase.from('call_transfers').insert({
      call_id: callId,
      from_agent_id: req.agent.id,
      to_agent_id: toAgentId || null,
      to_number: toNumber,
      transfer_type: 'cold',
      status: 'connected'
    });

    // Put original agent back to available
    const agentManager = req.app.get('agentManager');
    await agentManager.setAgentStatus(req.agent.id, 'available');

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transfers/warm — warm transfer (conference all three, then agent drops)
router.post('/warm', async (req, res) => {
  const { callControlId, callId, toNumber, toAgentId } = req.body;

  try {
    // Create a conference with the current call
    const confRes = await fetch('https://api.telnyx.com/v2/conferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`
      },
      body: JSON.stringify({
        name: `warm-transfer-${callId}`,
        call_control_id: callControlId,
        beep_enabled: 'never'
      })
    });
    const confData = await confRes.json();
    const conferenceId = confData.data?.id;

    // Dial the transfer target and add to conference
    const dialRes = await fetch('https://api.telnyx.com/v2/calls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`
      },
      body: JSON.stringify({
        connection_id: process.env.TELNYX_CONNECTION_ID,
        to: toNumber,
        from: process.env.TELNYX_PHONE_NUMBER,
        webhook_url: process.env.WEBHOOK_URL
      })
    });

    // Log the transfer
    await supabase.from('call_transfers').insert({
      call_id: callId,
      from_agent_id: req.agent.id,
      to_agent_id: toAgentId || null,
      to_number: toNumber,
      transfer_type: 'warm',
      status: 'initiated'
    });

    res.json({ success: true, conferenceId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transfers/complete-warm — agent drops from warm transfer
router.post('/complete-warm', async (req, res) => {
  const { conferenceId, agentCallControlId } = req.body;

  try {
    // Remove agent from conference (hang up their leg)
    await hangupCall(agentCallControlId);

    const agentManager = req.app.get('agentManager');
    await agentManager.setAgentStatus(req.agent.id, 'available');

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { router as transferRouter };
