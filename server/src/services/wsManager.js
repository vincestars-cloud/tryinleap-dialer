export class WSManager {
  constructor(wss) {
    this.wss = wss;
    this.clients = new Map(); // agentId -> ws

    wss.on('connection', (ws, req) => {
      const url = new URL(req.url, 'http://localhost');
      const agentId = url.searchParams.get('agentId');

      if (agentId) {
        this.clients.set(agentId, ws);
        console.log(`Agent ${agentId} connected via WebSocket`);

        ws.on('close', () => {
          this.clients.delete(agentId);
          console.log(`Agent ${agentId} disconnected`);
        });

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data);
            this.handleMessage(agentId, message);
          } catch (e) {
            console.error('Invalid WS message:', e);
          }
        });
      }
    });
  }

  handleMessage(agentId, message) {
    // Handle client-side messages (disposition, status change, etc.)
    // These are picked up by listeners registered via onMessage
    if (this._messageHandler) {
      this._messageHandler(agentId, message);
    }
  }

  onMessage(handler) {
    this._messageHandler = handler;
  }

  sendToAgent(agentId, event) {
    const ws = this.clients.get(agentId);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(event));
    }
  }

  broadcast(event) {
    const payload = JSON.stringify(event);
    for (const [, ws] of this.clients) {
      if (ws.readyState === 1) {
        ws.send(payload);
      }
    }
  }

  getConnectedAgentIds() {
    return Array.from(this.clients.keys());
  }
}
