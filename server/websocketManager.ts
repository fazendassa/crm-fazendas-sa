import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, AuthenticatedWebSocket[]> = new Map();

  setup(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const userId = url.searchParams.get('userId') || 'anonymous';
      ws.userId = userId;
      ws.isAlive = true;

      if (!this.clients.has(userId)) {
        this.clients.set(userId, []);
      }
      this.clients.get(userId)!.push(ws);

      ws.send(JSON.stringify({ type: 'connected' }));

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        } catch {
          // ignore malformed
        }
      });

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('close', () => this.removeClient(userId, ws));
      ws.on('error', () => this.removeClient(userId, ws));
    });

    // heartbeat
    const interval = setInterval(() => {
      this.wss?.clients.forEach((client: AuthenticatedWebSocket) => {
        if (!client.isAlive) return client.terminate();
        client.isAlive = false;
        client.ping();
      });
    }, 30000);

    this.wss.on('close', () => clearInterval(interval));
  }

  private removeClient(userId: string, ws: AuthenticatedWebSocket) {
    const arr = this.clients.get(userId);
    if (!arr) return;
    const idx = arr.indexOf(ws);
    if (idx !== -1) arr.splice(idx, 1);
    if (arr.length === 0) this.clients.delete(userId);
  }

  broadcastToUser(userId: string, message: unknown) {
    const arr = this.clients.get(userId);
    if (!arr) return;
    const str = JSON.stringify(message);
    arr.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(str);
    });
  }

  broadcastToAll(message: unknown) {
    const str = JSON.stringify(message);
    this.clients.forEach((arr) => {
      arr.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(str);
      });
    });
  }
}

export const webSocketManager = new WebSocketManager();
