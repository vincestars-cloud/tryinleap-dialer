import { Router } from 'express';
import { supabase } from '../services/supabase.js';

const router = Router();

// POST /api/monitor/listen — supervisor listens to agent's call (silent)
router.post('/listen', async (req, res) => {
  if (req.agent.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  const { agentId, callControlId, callId } = req.body;

  try {
    // Join the call's conference in listen-only mode
    const joinRes = await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/enqueue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`
      },
      body: JSON.stringify({})
    });

    // Log monitor session
    const { data } = await supabase.from('monitor_sessions').insert({
      supervisor_id: req.agent.id,
      agent_id: agentId,
      call_id: callId,
      mode: 'listen'
    }).select().single();

    // Notify agent's WebSocket that supervisor is listening (optional)
    const wsManager = req.app.get('wsManager');
    wsManager.sendToAgent(req.agent.id, {
      type: 'monitor_started',
      mode: 'listen',
      callControlId,
      agentId
    });

    res.json({ success: true, sessionId: data.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/monitor/whisper — supervisor can talk to agent only (caller can't hear)
router.post('/whisper', async (req, res) => {
  if (req.agent.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  const { agentId, callId } = req.body;

  const { data } = await supabase.from('monitor_sessions').insert({
    supervisor_id: req.agent.id,
    agent_id: agentId,
    call_id: callId,
    mode: 'whisper'
  }).select().single();

  const wsManager = req.app.get('wsManager');
  wsManager.sendToAgent(req.agent.id, {
    type: 'monitor_started',
    mode: 'whisper',
    agentId
  });

  res.json({ success: true, sessionId: data.id });
});

// POST /api/monitor/barge — supervisor joins the call (everyone can hear)
router.post('/barge', async (req, res) => {
  if (req.agent.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  const { agentId, callId } = req.body;

  const { data } = await supabase.from('monitor_sessions').insert({
    supervisor_id: req.agent.id,
    agent_id: agentId,
    call_id: callId,
    mode: 'barge'
  }).select().single();

  const wsManager = req.app.get('wsManager');
  wsManager.sendToAgent(agentId, {
    type: 'supervisor_barged',
    supervisorName: req.agent.name
  });

  res.json({ success: true, sessionId: data.id });
});

// POST /api/monitor/stop
router.post('/stop', async (req, res) => {
  const { sessionId } = req.body;
  await supabase.from('monitor_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', sessionId);
  res.json({ success: true });
});

// GET /api/monitor/active — list active monitor sessions
router.get('/active', async (req, res) => {
  const { data } = await supabase
    .from('monitor_sessions')
    .select('*, agents!monitor_sessions_agent_id_fkey(name)')
    .eq('supervisor_id', req.agent.id)
    .is('ended_at', null);
  res.json(data);
});

export { router as monitorRouter };
