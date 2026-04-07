import { Router } from 'express';

const router = Router();

// SIP credentials for WebRTC — created via Telnyx API
const SIP_USERNAME = 'gencred57bONaAfvlNio8vP26oMDEbndhTNbx6IeORWAttBkZ';
const SIP_PASSWORD = '36ddb859f7e74b7083767c039a76efc6';
const WEBRTC_CONNECTION_ID = '2932968873286174397';

// GET /api/webrtc/credentials
router.get('/credentials', async (req, res) => {
  res.json({
    login: SIP_USERNAME,
    password: SIP_PASSWORD,
    connectionId: WEBRTC_CONNECTION_ID
  });
});

// POST /api/webrtc/token — generate a short-lived JWT token for WebRTC
router.post('/token', async (req, res) => {
  try {
    const tokenRes = await fetch('https://api.telnyx.com/v2/telephony_credentials/078090ce-9e55-4ce6-8222-19395f8140d9/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`
      }
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return res.status(500).json({ error: 'Token generation failed', details: err });
    }

    const data = await tokenRes.text();
    res.json({ token: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { router as webrtcRouter };
