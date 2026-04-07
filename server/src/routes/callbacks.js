import { Router } from 'express';
import { supabase } from '../services/supabase.js';

const router = Router();

// GET /api/callbacks — list upcoming callbacks for current agent
router.get('/', async (req, res) => {
  const { status = 'pending', all } = req.query;
  let query = supabase
    .from('callbacks')
    .select('*, leads(first_name, last_name, phone), campaigns(name)')
    .eq('status', status)
    .order('scheduled_at', { ascending: true });

  // Non-admins only see their own callbacks
  if (!all || req.agent.role !== 'admin') {
    query = query.eq('agent_id', req.agent.id);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/callbacks — schedule a callback
router.post('/', async (req, res) => {
  const { leadId, campaignId, scheduledAt, notes } = req.body;
  const { data, error } = await supabase
    .from('callbacks')
    .insert({
      lead_id: leadId,
      agent_id: req.agent.id,
      campaign_id: campaignId || null,
      scheduled_at: scheduledAt,
      notes: notes || null,
      status: 'pending'
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PUT /api/callbacks/:id/complete
router.put('/:id/complete', async (req, res) => {
  const { data, error } = await supabase
    .from('callbacks')
    .update({ status: 'completed' })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/callbacks/:id
router.delete('/:id', async (req, res) => {
  await supabase.from('callbacks').delete().eq('id', req.params.id);
  res.json({ success: true });
});

export { router as callbackRouter };
