import { Router } from 'express';
import { supabase } from '../services/supabase.js';
import { generateToken, hashPassword } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (!agent || agent.password_hash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateToken(agent.id);

  res.json({
    token,
    agent: {
      id: agent.id,
      email: agent.email,
      name: agent.name,
      role: agent.role,
      status: agent.status
    }
  });
});

// POST /api/auth/register (admin only in production)
router.post('/register', async (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name required' });
  }

  const { data: existing } = await supabase
    .from('agents')
    .select('id')
    .eq('email', email.toLowerCase())
    .single();

  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const { data: agent, error } = await supabase
    .from('agents')
    .insert({
      email: email.toLowerCase(),
      password_hash: hashPassword(password),
      name,
      role: role || 'agent'
    })
    .select('id, email, name, role, status')
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const token = generateToken(agent.id);
  res.status(201).json({ token, agent });
});

export { router as authRouter };
