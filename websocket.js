const { WebSocketServer, WebSocket } = require('ws');

let wss = null;
let heartbeatInterval = null;

/**
 * Initialize the WebSocket Server on an existing HTTP server instance
 * @param {import('http').Server} server - The HTTP server instance
 * @returns {WebSocketServer}
 */
function initWebSocket(server) {
  if (wss) {
    return wss;
  }

  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Send initial handshake with connected client count and timestamp
    const welcomePayload = {
      type: 'INIT',
      message: 'Connected to WebSocket Server',
      clientsCount: wss.clients.size,
      timestamp: new Date().toISOString()
    };
    ws.send(JSON.stringify(welcomePayload));

    // Broadcast updated client count to all connected clients
    broadcast({
      type: 'CLIENTS_COUNT',
      count: wss.clients.size,
      timestamp: new Date().toISOString()
    });

    // Handle incoming client messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());

        switch (message.type) {
          case 'PING':
            ws.send(JSON.stringify({
              type: 'PONG',
              timestamp: new Date().toISOString()
            }));
            break;

          case 'GET_STATS':
            ws.send(JSON.stringify({
              type: 'STATS',
              connectedClients: wss.clients.size,
              uptimeSeconds: Math.round(process.uptime()),
              memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
              timestamp: new Date().toISOString()
            }));
            break;

          default:
            ws.send(JSON.stringify({
              type: 'ECHO',
              payload: message,
              timestamp: new Date().toISOString()
            }));
            break;
        }
      } catch (err) {
        // Fallback for non-JSON text messages like raw "ping"
        if (data.toString().trim().toLowerCase() === 'ping') {
          ws.send('pong');
        } else {
          ws.send(JSON.stringify({
            type: 'ERROR',
            message: 'Invalid JSON payload'
          }));
        }
      }
    });

    ws.on('close', () => {
      if (wss && wss.clients) {
        broadcast({
          type: 'CLIENTS_COUNT',
          count: wss.clients.size,
          timestamp: new Date().toISOString()
        });
      }
    });

    ws.on('error', (err) => {
      console.error('WebSocket client error:', err.message);
    });
  });

  // Heartbeat mechanism to prune dead connections
  heartbeatInterval = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  return wss;
}

/**
 * Broadcast an event payload to all currently connected clients
 * @param {object|string} payload - JSON event object or string to broadcast
 */
function broadcast(payload) {
  if (!wss || !wss.clients) return;

  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

/**
 * Get current WebSocket server instance
 * @returns {WebSocketServer|null}
 */
function getWebSocketServer() {
  return wss;
}

/**
 * Gracefully close WebSocket server and clear intervals
 */
function closeWebSocket() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  if (wss) {
    wss.clients.forEach((client) => {
      client.terminate();
    });
    wss.close();
    wss = null;
  }
}

module.exports = {
  initWebSocket,
  broadcast,
  getWebSocketServer,
  closeWebSocket
};
