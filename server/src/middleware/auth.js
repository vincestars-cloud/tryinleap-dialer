import { supabase } from '../services/supabase.js';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

// Simple token-based auth (JWT-like using HMAC)
export function generateToken(agentId) {
  const payload = Buffer.from(JSON.stringify({ id: agentId, exp: Date.now() + 86400000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyToken(token) {
  const [payload, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('base64url');
  if (signature !== expected) return null;

  const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  if (data.exp < Date.now()) return null;
  return data;
}

export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { data: agent } = await supabase
    .from('agents')
    .select('id, email, name, role, status')
    .eq('id', payload.id)
    .single();

  if (!agent) {
    return res.status(401).json({ error: 'Agent not found' });
  }

  req.agent = agent;
  next();
}

export function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex');
}
