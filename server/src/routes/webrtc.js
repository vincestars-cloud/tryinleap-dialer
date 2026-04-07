import { Router } from 'express';
import { supabase } from '../services/supabase.js';
import { telnyx } from '../services/telnyx.js';

const router = Router();

// GET /api/webrtc/credentials
// Returns SIP credentials for the agent to connect via WebRTC
router.get('/credentials', async (req, res) => {
  const agentId = req.agent.id;

  // Check if agent already has SIP credentials stored
  const { data: agent } = await supabase
    .from('agents')
    .select('sip_username, sip_password')
    .eq('id', agentId)
    .single();

  if (agent?.sip_username && agent?.sip_password) {
    return res.json({
      login: agent.sip_username,
      password: agent.sip_password,
      connectionId: process.env.TELNYX_CONNECTION_ID
    });
  }

  // Create new SIP credentials via Telnyx API
  try {
    const sipUser = `agent_${agentId.replace(/-/g, '').substring(0, 16)}`;
    const sipPass = generateSipPassword();

    // Create credential via Telnyx REST API
    const createRes = await fetch('https://api.telnyx.com/v2/telephony_credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`
      },
      body: JSON.stringify({
        connection_id: process.env.TELNYX_CONNECTION_ID,
        name: `TryInLeap Agent ${req.agent.name}`,
        sip_username: sipUser,
        sip_password: sipPass
      })
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      console.error('SIP credential creation failed:', err);
      return res.status(500).json({ error: 'Failed to create SIP credentials' });
    }

    const credData = await createRes.json();

    // Store credentials in agent record
    await supabase
      .from('agents')
      .update({ sip_username: sipUser, sip_password: sipPass })
      .eq('id', agentId);

    res.json({
      login: sipUser,
      password: sipPass,
      connectionId: process.env.TELNYX_CONNECTION_ID
    });
  } catch (err) {
    console.error('SIP credential error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/webrtc/token
// Generate a short-lived credential token for WebRTC
router.get('/token', async (req, res) => {
  try {
    const tokenRes = await fetch('https://api.telnyx.com/v2/telephony_credentials/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`
      },
      body: JSON.stringify({
        connection_id: process.env.TELNYX_CONNECTION_ID
      })
    });

    if (!tokenRes.ok) {
      return res.status(500).json({ error: 'Failed to generate token' });
    }

    const data = await tokenRes.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function generateSipPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let password = '';
  for (let i = 0; i < 24; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export { router as webrtcRouter };
