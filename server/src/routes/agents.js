import { Router } from 'express';
import { supabase } from '../services/supabase.js';

const router = Router();

// GET /api/agents
router.get('/', async (req, res) => {
  const agentManager = req.app.get('agentManager');
  const { data: agents } = await supabase
    .from('agents')
    .select('id, email, name, role, status, created_at');

  // Merge live state
  const liveStates = agentManager.getAllAgentStates();
  const enriched = agents.map(a => ({
    ...a,
    liveStatus: liveStates[a.id]?.status || a.status,
    currentCallId: liveStates[a.id]?.currentCallId || null,
    campaignId: liveStates[a.id]?.campaignId || null
  }));

  res.json(enriched);
});

// POST /api/agents/go-available
router.post('/go-available', async (req, res) => {
  const { campaignId } = req.body;
  const agentManager = req.app.get('agentManager');
  agentManager.registerAgent(req.agent.id, campaignId);
  await agentManager.setAgentStatus(req.agent.id, 'available');
  res.json({ success: true, status: 'available' });
});

// POST /api/agents/go-offline
router.post('/go-offline', async (req, res) => {
  const agentManager = req.app.get('agentManager');
  agentManager.unregisterAgent(req.agent.id);
  await agentManager.setAgentStatus(req.agent.id, 'offline');
  res.json({ success: true, status: 'offline' });
});

// POST /api/agents/pause
router.post('/pause', async (req, res) => {
  const agentManager = req.app.get('agentManager');
  await agentManager.setAgentStatus(req.agent.id, 'paused');
  res.json({ success: true, status: 'paused' });
});

// POST /api/agents/disposition
router.post('/disposition', async (req, res) => {
  const { callId, dispositionCode, notes } = req.body;
  const agentManager = req.app.get('agentManager');

  // Update call record
  await supabase
    .from('calls')
    .update({ disposition_code: dispositionCode })
    .eq('id', callId);

  // Update lead with last disposition
  const { data: call } = await supabase
    .from('calls')
    .select('lead_id')
    .eq('id', callId)
    .single();

  if (call?.lead_id) {
    // Check if disposition is final
    const { data: disp } = await supabase
      .from('dispositions')
      .select('is_final')
      .eq('code', dispositionCode)
      .single();

    const leadUpdate = { last_disposition: dispositionCode };
    if (dispositionCode === 'DNC') {
      leadUpdate.is_dnc = true;
      leadUpdate.status = 'dnc';
      // Add to DNC list
      await supabase.from('dnc_list').upsert({
        phone: (await supabase.from('leads').select('phone').eq('id', call.lead_id).single()).data.phone,
        reason: 'Agent disposition',
        added_by: req.agent.id
      }, { onConflict: 'phone' });
    } else if (dispositionCode === 'SALE' || dispositionCode === 'APPT') {
      leadUpdate.status = 'converted';
    } else if (disp?.is_final) {
      leadUpdate.status = 'dead';
    } else {
      leadUpdate.status = 'contacted';
    }

    await supabase.from('leads').update(leadUpdate).eq('id', call.lead_id);

    // Save notes if provided
    if (notes) {
      await supabase.from('call_notes').insert({
        call_id: callId,
        lead_id: call.lead_id,
        agent_id: req.agent.id,
        content: notes
      });
    }
  }

  // Agent wrap-up complete, go back to available
  await agentManager.setAgentStatus(req.agent.id, 'available');

  res.json({ success: true });
});

// GET /api/agents/me
router.get('/me', (req, res) => {
  const agentManager = req.app.get('agentManager');
  const liveState = agentManager.getAgentState(req.agent.id);
  res.json({ ...req.agent, liveState });
});

export { router as agentRouter };
