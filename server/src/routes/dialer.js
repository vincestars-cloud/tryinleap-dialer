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
