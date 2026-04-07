import { Router } from 'express';
import { supabase } from '../services/supabase.js';
import { sendSMS } from '../services/telnyx.js';

const router = Router();

// POST /api/sms/send
router.post('/send', async (req, res) => {
  const { to, body, leadId } = req.body;

  if (!to || !body) {
    return res.status(400).json({ error: 'to and body are required' });
  }

  try {
    const result = await sendSMS({ to, body });

    // Log to DB
    await supabase.from('sms_messages').insert({
      telnyx_message_id: result.id,
      lead_id: leadId || null,
      agent_id: req.agent.id,
      from_number: process.env.TELNYX_PHONE_NUMBER,
      to_number: to,
      body,
      direction: 'outbound',
      status: 'sent'
    });

    res.json({ success: true, messageId: result.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sms/conversation/:leadId
router.get('/conversation/:leadId', async (req, res) => {
  const { data, error } = await supabase
    .from('sms_messages')
    .select('*')
    .eq('lead_id', req.params.leadId)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/sms/history
router.get('/history', async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  const { data, count } = await supabase
    .from('sms_messages')
    .select('*, leads(first_name, last_name, phone)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  res.json({ messages: data, total: count, page: Number(page) });
});

export { router as smsRouter };
