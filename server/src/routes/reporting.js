import { Router } from 'express';
import { supabase } from '../services/supabase.js';

const router = Router();

// GET /api/reporting/overview — high-level stats
router.get('/overview', async (req, res) => {
  const { campaign_id, start_date, end_date } = req.query;
  const start = start_date || new Date(Date.now() - 86400000).toISOString();
  const end = end_date || new Date().toISOString();

  let callQuery = supabase
    .from('calls')
    .select('status, amd_result, duration_seconds, disposition_code, agent_id', { count: 'exact' })
    .gte('created_at', start)
    .lte('created_at', end);

  if (campaign_id) callQuery = callQuery.eq('campaign_id', campaign_id);

  const { data: calls, count: totalCalls } = await callQuery;

  const stats = {
    totalCalls: totalCalls || 0,
    answered: calls?.filter(c => c.status === 'answered' || c.status === 'bridged' || c.status === 'completed').length || 0,
    connected: calls?.filter(c => c.agent_id && (c.status === 'completed' || c.status === 'bridged')).length || 0,
    machineDetected: calls?.filter(c => c.amd_result === 'machine').length || 0,
    noAnswer: calls?.filter(c => c.status === 'no_answer').length || 0,
    busy: calls?.filter(c => c.status === 'busy').length || 0,
    avgDuration: 0,
    totalTalkTime: 0,
    contactRate: 0,
    conversionRate: 0,
    dispositions: {}
  };

  // Calculate averages
  const connectedCalls = calls?.filter(c => c.duration_seconds > 0) || [];
  stats.avgDuration = connectedCalls.length > 0
    ? Math.round(connectedCalls.reduce((sum, c) => sum + c.duration_seconds, 0) / connectedCalls.length)
    : 0;
  stats.totalTalkTime = connectedCalls.reduce((sum, c) => sum + c.duration_seconds, 0);
  stats.contactRate = totalCalls > 0 ? Math.round((stats.connected / totalCalls) * 100) : 0;

  // Disposition breakdown
  const conversions = calls?.filter(c => c.disposition_code === 'SALE' || c.disposition_code === 'APPT').length || 0;
  stats.conversionRate = stats.connected > 0 ? Math.round((conversions / stats.connected) * 100) : 0;

  calls?.forEach(c => {
    if (c.disposition_code) {
      stats.dispositions[c.disposition_code] = (stats.dispositions[c.disposition_code] || 0) + 1;
    }
  });

  res.json(stats);
});

// GET /api/reporting/agent-performance
router.get('/agent-performance', async (req, res) => {
  const { start_date, end_date, campaign_id } = req.query;
  const start = start_date || new Date(Date.now() - 86400000).toISOString();
  const end = end_date || new Date().toISOString();

  // Get all agents
  const { data: agents } = await supabase.from('agents').select('id, name, email');

  const performance = await Promise.all(agents.map(async (agent) => {
    let query = supabase
      .from('calls')
      .select('status, duration_seconds, disposition_code')
      .eq('agent_id', agent.id)
      .gte('created_at', start)
      .lte('created_at', end);

    if (campaign_id) query = query.eq('campaign_id', campaign_id);

    const { data: calls } = await query;

    const totalCalls = calls?.length || 0;
    const connected = calls?.filter(c => c.duration_seconds > 0) || [];
    const sales = calls?.filter(c => c.disposition_code === 'SALE').length || 0;
    const appts = calls?.filter(c => c.disposition_code === 'APPT').length || 0;
    const totalTalkTime = connected.reduce((sum, c) => sum + c.duration_seconds, 0);
    const avgTalkTime = connected.length > 0 ? Math.round(totalTalkTime / connected.length) : 0;

    return {
      agentId: agent.id,
      name: agent.name,
      email: agent.email,
      totalCalls,
      connectedCalls: connected.length,
      sales,
      appointments: appts,
      totalTalkTime,
      avgTalkTime,
      conversionRate: connected.length > 0 ? Math.round(((sales + appts) / connected.length) * 100) : 0
    };
  }));

  res.json(performance);
});

// GET /api/reporting/hourly — calls by hour for charts
router.get('/hourly', async (req, res) => {
  const { campaign_id, date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];
  const start = `${targetDate}T00:00:00Z`;
  const end = `${targetDate}T23:59:59Z`;

  let query = supabase
    .from('calls')
    .select('created_at, status, amd_result, agent_id')
    .gte('created_at', start)
    .lte('created_at', end);

  if (campaign_id) query = query.eq('campaign_id', campaign_id);

  const { data: calls } = await query;

  // Group by hour
  const hourly = {};
  for (let h = 0; h < 24; h++) {
    hourly[h] = { hour: h, calls: 0, connected: 0, machine: 0 };
  }

  calls?.forEach(c => {
    const hour = new Date(c.created_at).getHours();
    hourly[hour].calls++;
    if (c.agent_id) hourly[hour].connected++;
    if (c.amd_result === 'machine') hourly[hour].machine++;
  });

  res.json(Object.values(hourly));
});

// GET /api/reporting/campaign-summary
router.get('/campaign-summary', async (req, res) => {
  const { data: campaigns } = await supabase.from('campaigns').select('id, name, status, dial_mode');

  const summaries = await Promise.all(campaigns.map(async (campaign) => {
    const { count: totalLeads } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id);

    const { count: contactedLeads } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .gt('attempts', 0);

    const { count: totalCalls } = await supabase
      .from('calls')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id);

    const { count: conversions } = await supabase
      .from('calls')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .in('disposition_code', ['SALE', 'APPT']);

    return {
      ...campaign,
      totalLeads: totalLeads || 0,
      contactedLeads: contactedLeads || 0,
      totalCalls: totalCalls || 0,
      conversions: conversions || 0,
      penetration: totalLeads > 0 ? Math.round((contactedLeads / totalLeads) * 100) : 0
    };
  }));

  res.json(summaries);
});

export { router as reportingRouter };
