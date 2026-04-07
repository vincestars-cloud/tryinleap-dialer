import { Router } from 'express';
import multer from 'multer';
import { supabase } from '../services/supabase.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

// GET /api/leads
router.get('/', async (req, res) => {
  const { campaign_id, status, search, page = 1, limit = 50 } = req.query;
  let query = supabase
    .from('leads')
    .select('*, campaigns(name)', { count: 'exact' });

  if (campaign_id) query = query.eq('campaign_id', campaign_id);
  if (status) query = query.eq('status', status);
  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const offset = (page - 1) * limit;
  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json({ leads: data, total: count, page: Number(page), limit: Number(limit) });
});

// GET /api/leads/:id
router.get('/:id', async (req, res) => {
  const { data: lead } = await supabase
    .from('leads')
    .select('*, campaigns(name)')
    .eq('id', req.params.id)
    .single();

  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  // Get call history for this lead
  const { data: calls } = await supabase
    .from('calls')
    .select('*, agents(name)')
    .eq('lead_id', req.params.id)
    .order('created_at', { ascending: false });

  // Get notes
  const { data: notes } = await supabase
    .from('call_notes')
    .select('*, agents(name)')
    .eq('lead_id', req.params.id)
    .order('created_at', { ascending: false });

  // Get SMS history
  const { data: messages } = await supabase
    .from('sms_messages')
    .select('*')
    .eq('lead_id', req.params.id)
    .order('created_at', { ascending: false });

  res.json({ lead, calls, notes, messages });
});

// POST /api/leads
router.post('/', async (req, res) => {
  const { data, error } = await supabase
    .from('leads')
    .insert(req.body)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// POST /api/leads/upload-csv
router.post('/upload-csv', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const csvText = req.file.buffer.toString('utf-8');
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return res.status(400).json({ error: 'CSV must have a header row and at least one data row' });

  const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  // Map common header variations to our schema fields
  const headerMap = {
    'first_name': 'first_name', 'firstname': 'first_name', 'first name': 'first_name', 'first': 'first_name',
    'last_name': 'last_name', 'lastname': 'last_name', 'last name': 'last_name', 'last': 'last_name',
    'phone': 'phone', 'phone_number': 'phone', 'phone number': 'phone', 'mobile': 'phone', 'cell': 'phone',
    'email': 'email', 'email_address': 'email', 'email address': 'email',
    'company': 'company', 'company_name': 'company', 'company name': 'company',
    'address': 'address', 'street': 'address', 'street_address': 'address',
    'city': 'city', 'state': 'state', 'zip': 'zip', 'zipcode': 'zip', 'zip_code': 'zip'
  };

  const headers = rawHeaders.map(h => headerMap[h.toLowerCase()] || h.toLowerCase().replace(/\s+/g, '_'));
  const campaignId = req.body.campaign_id || null;

  const leads = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
    if (values.length < 2) continue;

    const lead = {};
    headers.forEach((h, idx) => { if (values[idx]) lead[h] = values[idx]; });

    if (!lead.phone) continue;

    // Normalize phone to E.164 if it looks like a US number
    let phone = lead.phone.replace(/[\s\-\(\)\.]/g, '');
    if (phone.length === 10 && !phone.startsWith('+')) phone = '+1' + phone;
    if (phone.length === 11 && phone.startsWith('1')) phone = '+' + phone;
    lead.phone = phone;

    if (campaignId) lead.campaign_id = campaignId;
    leads.push(lead);
  }

  if (leads.length === 0) return res.status(400).json({ error: 'No valid leads found in CSV' });

  // DNC check
  const phones = leads.map(l => l.phone);
  const { data: dncNumbers } = await supabase.from('dnc_list').select('phone').in('phone', phones);
  const dncSet = new Set(dncNumbers?.map(d => d.phone) || []);
  const cleanLeads = leads.filter(l => !dncSet.has(l.phone)).map(l => ({ ...l, is_dnc: false }));
  const skipped = leads.length - cleanLeads.length;

  // Insert in batches of 500
  let imported = 0;
  for (let i = 0; i < cleanLeads.length; i += 500) {
    const batch = cleanLeads.slice(i, i + 500);
    const { data, error } = await supabase.from('leads').insert(batch).select();
    if (error) return res.status(500).json({ error: error.message, imported });
    imported += data.length;
  }

  res.status(201).json({ imported, skipped_dnc: skipped, total_rows: lines.length - 1 });
});

// POST /api/leads/bulk
router.post('/bulk', async (req, res) => {
  const { leads } = req.body;
  if (!Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({ error: 'Provide an array of leads' });
  }

  // Check DNC list
  const phones = leads.map(l => l.phone);
  const { data: dncNumbers } = await supabase
    .from('dnc_list')
    .select('phone')
    .in('phone', phones);

  const dncSet = new Set(dncNumbers?.map(d => d.phone) || []);
  const cleanLeads = leads
    .filter(l => !dncSet.has(l.phone))
    .map(l => ({ ...l, is_dnc: false }));

  const skipped = leads.length - cleanLeads.length;

  const { data, error } = await supabase
    .from('leads')
    .insert(cleanLeads)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ imported: data.length, skipped_dnc: skipped });
});

// PUT /api/leads/:id
router.put('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('leads')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/leads/:id
router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// POST /api/leads/:id/notes
router.post('/:id/notes', async (req, res) => {
  const { content, callId } = req.body;
  const { data, error } = await supabase
    .from('call_notes')
    .insert({
      lead_id: req.params.id,
      call_id: callId || null,
      agent_id: req.agent.id,
      content
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

export { router as leadRouter };
