import { Router } from 'express';
import { supabase } from '../services/supabase.js';

const router = Router();

// GET /api/recordings
router.get('/', async (req, res) => {
  const { campaign_id, agent_id, page = 1, limit = 50 } = req.query;

  let query = supabase
    .from('calls')
    .select('id, lead_id, agent_id, to_number, disposition_code, duration_seconds, recording_url, recording_duration_seconds, started_at, leads(first_name, last_name), agents(name)', { count: 'exact' })
    .not('recording_url', 'is', null);

  if (campaign_id) query = query.eq('campaign_id', campaign_id);
  if (agent_id) query = query.eq('agent_id', agent_id);

  const offset = (page - 1) * limit;
  query = query.order('started_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, count } = await query;
  res.json({ recordings: data, total: count, page: Number(page) });
});

export { router as recordingRouter };
