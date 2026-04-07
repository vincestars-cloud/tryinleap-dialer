import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { telnyxWebhookRouter } from './webhooks/telnyx.js';
import { dialerRouter } from './routes/dialer.js';
import { agentRouter } from './routes/agents.js';
import { leadRouter } from './routes/leads.js';
import { campaignRouter } from './routes/campaigns.js';
import { smsRouter } from './routes/sms.js';
import { recordingRouter } from './routes/recordings.js';
import { webrtcRouter } from './routes/webrtc.js';
import { authRouter } from './routes/auth.js';
import { authMiddleware } from './middleware/auth.js';
import { DialerEngine } from './services/dialerEngine.js';
import { AgentManager } from './services/agentManager.js';
import { WSManager } from './services/wsManager.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Initialize core services
const wsManager = new WSManager(wss);
const agentManager = new AgentManager(wsManager);
const dialerEngine = new DialerEngine(agentManager, wsManager);

// Make services available to routes
app.set('dialerEngine', dialerEngine);
app.set('agentManager', agentManager);
app.set('wsManager', wsManager);

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Public routes
app.use('/webhooks/telnyx', telnyxWebhookRouter);
app.use('/api/auth', authRouter);

// Protected routes
app.use('/api/dialer', authMiddleware, dialerRouter);
app.use('/api/agents', authMiddleware, agentRouter);
app.use('/api/leads', authMiddleware, leadRouter);
app.use('/api/campaigns', authMiddleware, campaignRouter);
app.use('/api/sms', authMiddleware, smsRouter);
app.use('/api/recordings', authMiddleware, recordingRouter);
app.use('/api/webrtc', authMiddleware, webrtcRouter);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// Serve React frontend in production
const clientBuild = path.join(__dirname, '../../client/dist');
app.use(express.static(clientBuild));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuild, 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`TryInLeap Dialer running on port ${PORT}`);
});
