import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { createServer } from 'http';
import crypto from 'crypto';

const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'WebRTC signaling server running' });
});

const server = createServer(app);
const wss = new WebSocketServer({ server });
const HEARTBEAT_INTERVAL = Number(process.env.HEARTBEAT_INTERVAL_MS ?? 25000);

const rooms = new Map();

const buildRoom = (roomId) => {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      broadcaster: null,
      viewers: new Map(),
    });
  }
  return rooms.get(roomId);
};

const cleanupClient = (roomId, role, clientId) => {
  const room = rooms.get(roomId);
  if (!room) return;

  if (role === 'broadcaster') {
    room.broadcaster = null;
    room.viewers.forEach((viewer) => {
      viewer.socket.send(
        JSON.stringify({
          type: 'broadcaster-status',
          online: false,
        }),
      );
    });
  } else if (role === 'viewer' && clientId) {
    const viewer = room.viewers.get(clientId);
    if (viewer) {
      room.viewers.delete(clientId);
      if (room.broadcaster) {
        room.broadcaster.socket.send(
          JSON.stringify({
            type: 'viewer-left',
            viewerId: clientId,
          }),
        );
      }
    }
  }

  if (!room.broadcaster && room.viewers.size === 0) {
    rooms.delete(roomId);
  }
};

wss.on('connection', (socket) => {
  let roomId = null;
  let role = null;
  let clientId = null;
  socket.isAlive = true;

  socket.on('pong', () => {
    socket.isAlive = true;
  });

  socket.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'join') {
        roomId = msg.room;
        role = msg.role;

        if (!roomId || !role) {
          socket.send(JSON.stringify({ type: 'error', message: 'Room and role required' }));
          return;
        }

        const room = buildRoom(roomId);

        if (role === 'broadcaster') {
          clientId = 'broadcaster';
          room.broadcaster = { socket, id: clientId };
          socket.send(JSON.stringify({ type: 'joined', role: 'broadcaster', room: roomId }));
          room.viewers.forEach((viewer) => {
            viewer.socket.send(JSON.stringify({ type: 'broadcaster-status', online: true }));
          });
        } else {
          clientId = crypto.randomUUID();
          room.viewers.set(clientId, { socket, id: clientId });
          socket.send(
            JSON.stringify({ type: 'registered', clientId, room: roomId }),
          );
          if (room.broadcaster) {
            room.broadcaster.socket.send(
              JSON.stringify({
                type: 'viewer-joined',
                viewerId: clientId,
              }),
            );
            socket.send(JSON.stringify({ type: 'broadcaster-status', online: true }));
          } else {
            socket.send(JSON.stringify({ type: 'broadcaster-status', online: false }));
          }
        }
        return;
      }

      if (msg.type === 'signal') {
        if (!roomId || !role) {
          return;
        }
        const room = rooms.get(roomId);
        if (!room) return;

        if (role === 'viewer') {
          const broadcaster = room.broadcaster;
          if (broadcaster) {
            broadcaster.socket.send(
              JSON.stringify({
                type: 'signal',
                viewerId: clientId,
                payload: msg.payload,
              }),
            );
          }
        } else if (role === 'broadcaster') {
          const targetViewer = room.viewers.get(msg.to);
          if (targetViewer) {
            targetViewer.socket.send(
              JSON.stringify({
                type: 'signal',
                viewerId: msg.to,
                payload: msg.payload,
              }),
            );
          }
        }
      }
    } catch (error) {
      console.error('Signaling error:', error);
    }
  });

  socket.on('close', () => {
    cleanupClient(roomId, role, clientId);
  });
});

const heartbeat = () => {
  wss.clients.forEach((client) => {
    if (client.readyState === client.CLOSING || client.readyState === client.CLOSED) {
      return;
    }
    if (client.isAlive === false) {
      client.terminate();
      return;
    }
    client.isAlive = false;
    if (typeof client.ping === 'function') {
      client.ping();
    } else {
      client.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
    }
  });
};

const heartbeatInterval = setInterval(heartbeat, HEARTBEAT_INTERVAL);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

server.listen(PORT, () => {
  console.log(`Signaling server listening on port ${PORT}`);
});
