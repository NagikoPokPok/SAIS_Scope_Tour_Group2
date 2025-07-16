const WebSocket = require('ws');

const websocketMiddleware = (server) => {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('New client connected');

    ws.on('message', (message) => {
      console.log(`Received message: ${message}`);
      // Handle incoming messages if needed
    });

    ws.on('close', () => {
      console.log('Client disconnected');
    });
  });

  const broadcast = (data) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  return {
    broadcast,
  };
};

module.exports = websocketMiddleware;