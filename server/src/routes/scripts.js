import { Router } from 'express';
import { supabase } from '../services/supabase.js';

const router = Router();

// GET /api/scripts?campaign_id=xxx
router.get('/', async (req, res) => {
  const { campaign_id } = req.query;
  let query = supabase
    .from('campaign_scripts')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (campaign_id) query = query.eq('campaign_id', campaign_id);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/scripts
router.post('/', async (req, res) => {
  const { campaign_id, name, content, sort_order } = req.body;
  const { data, error } = await supabase
    .from('campaign_scripts')
    .insert({ campaign_id, name, content, sort_order: sort_order || 0 })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PUT /api/scripts/:id
router.put('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('campaign_scripts')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/scripts/:id
router.delete('/:id', async (req, res) => {
  await supabase.from('campaign_scripts').delete().eq('id', req.params.id);
  res.json({ success: true });
});

export { router as scriptRouter };
