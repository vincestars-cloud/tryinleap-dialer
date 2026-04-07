import { Router } from 'express';
import { supabase } from '../services/supabase.js';

const router = Router();

// GET /api/campaigns
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Enrich with lead counts
  const enriched = await Promise.all(data.map(async (campaign) => {
    const { count: totalLeads } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id);

    const { count: dialedLeads } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .gt('attempts', 0);

    return { ...campaign, total_leads: totalLeads, dialed_leads: dialedLeads };
  }));

  res.json(enriched);
});

// GET /api/campaigns/:id
router.get('/:id', async (req, res) => {
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  // Get assigned agents
  const { data: assignments } = await supabase
    .from('agent_campaigns')
    .select('agent_id, agents(id, name, email, status)')
    .eq('campaign_id', req.params.id);

  // Get stats
  const { count: totalLeads } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', req.params.id);

  const { count: callsMade } = await supabase
    .from('calls')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', req.params.id);

  const { count: connections } = await supabase
    .from('calls')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', req.params.id)
    .eq('status', 'completed')
    .not('agent_id', 'is', null);

  res.json({
    ...campaign,
    agents: assignments?.map(a => a.agents) || [],
    stats: { totalLeads, callsMade, connections }
  });
});

// POST /api/campaigns
router.post('/', async (req, res) => {
  const { name, description, dial_mode, dial_ratio, caller_id, max_attempts, retry_delay_minutes, voicemail_drop_url } = req.body;

  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      name,
      description,
      dial_mode: dial_mode || 'predictive',
      dial_ratio: dial_ratio || 2.0,
      caller_id: caller_id || process.env.TELNYX_PHONE_NUMBER,
      max_attempts: max_attempts || 3,
      retry_delay_minutes: retry_delay_minutes || 60,
      voicemail_drop_url
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PUT /api/campaigns/:id
router.put('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('campaigns')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/campaigns/:id/agents
router.post('/:id/agents', async (req, res) => {
  const { agentIds } = req.body;
  const campaignId = req.params.id;

  // Remove existing assignments
  await supabase.from('agent_campaigns').delete().eq('campaign_id', campaignId);

  // Add new assignments
  if (agentIds?.length > 0) {
    const assignments = agentIds.map(agentId => ({ agent_id: agentId, campaign_id: campaignId }));
    await supabase.from('agent_campaigns').insert(assignments);
  }

  res.json({ success: true });
});

// DELETE /api/campaigns/:id
router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// GET /api/campaigns/:id/dispositions
router.get('/:id/dispositions', async (req, res) => {
  const { data } = await supabase
    .from('dispositions')
    .select('*')
    .order('sort_order');

  res.json(data);
});

export { router as campaignRouter };
