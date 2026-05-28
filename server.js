import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import QRCode from 'qrcode';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }   // friends on phones from various origins; fine for this use
});

// Serve the client (everything in /public) as static files.
app.use(express.static(join(__dirname, 'public')));


const rooms = {};

function makeCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing O/0/I/1
  let code;
  do {
    code = Array.from({ length: 4 }, () =>
      letters[Math.floor(Math.random() * letters.length)]).join('');
  } while (rooms[code]);
  return code;
}

/* QR endpoint: returns a PNG data-URL for a given join link.
   The client calls this to show a scannable code on the host screen. */
app.get('/qr', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('missing url');
  try {
    const png = await QRCode.toDataURL(url, { margin: 1, width: 320 });
    res.json({ png });
  } catch (e) {
    res.status(500).send('qr error');
  }
});

/* Health check — handy for Railway and for warming the instance before a session. */
app.get('/healthz', (_req, res) => res.send('ok'));


io.on('connection', (socket) => {
  // which room this socket is in (filled once they create/join)
  let joinedRoom = null;

  /* HOST creates a room. */
  socket.on('createRoom', (player, ack) => {
    const code = makeCode();
    rooms[code] = {
      hostId: socket.id,
      players: { [socket.id]: sanitize(player) },
      createdAt: Date.now()
    };
    joinedRoom = code;
    socket.join(code);
    // tell the host their room code + that they are the host
    ack && ack({ ok: true, code, isHost: true, you: socket.id });
    broadcastPlayerList(code);
  });

  /* A PLAYER joins an existing room by code. */
  socket.on('joinRoom', ({ code, player }, ack) => {
    code = (code || '').toUpperCase().trim();
    const room = rooms[code];
    if (!room) { ack && ack({ ok: false, error: 'Room not found' }); return; }
    if (Object.keys(room.players).length >= 6) {
      ack && ack({ ok: false, error: 'Room is full' }); return;
    }
    room.players[socket.id] = sanitize(player);
    joinedRoom = code;
    socket.join(code);
    ack && ack({ ok: true, code, isHost: false, you: socket.id, hostId: room.hostId });
    broadcastPlayerList(code);
    // let the host know a new player needs to be spawned
    io.to(room.hostId).emit('playerJoined', { id: socket.id, player: room.players[socket.id] });
  });

  /* NON-HOST sends their input state up; we forward only to the host. */
  socket.on('input', (state) => {
    if (!joinedRoom) return;
    const room = rooms[joinedRoom];
    if (!room) return;
    io.to(room.hostId).emit('input', { id: socket.id, state });
  });

  /* HOST sends a world snapshot; we broadcast to everyone else in the room. */
  socket.on('snapshot', (snap) => {
    if (!joinedRoom) return;
    const room = rooms[joinedRoom];
    if (!room || room.hostId !== socket.id) return; // only the host may snapshot
    // volatile = drop if the network is congested; newer snapshot will come anyway
    socket.to(joinedRoom).volatile.emit('snapshot', snap);
  });


  socket.on('hostEvent', (evt) => {
    if (!joinedRoom) { console.log('[hostEvent] dropped: no joinedRoom for', socket.id); return; }
    const room = rooms[joinedRoom];
    if (!room) { console.log('[hostEvent] dropped: room', joinedRoom, 'gone'); return; }
    if (room.hostId !== socket.id) {
      const hostStillConnected = io.sockets.sockets.has(room.hostId);
      if (!hostStillConnected && room.players[socket.id]) {
        room.hostId = socket.id;
        console.log('[hostEvent] adopted new host', socket.id, 'for room', joinedRoom);
      }
    }
    if (room.hostId !== socket.id) { console.log('[hostEvent] dropped: not host. sender', socket.id, 'host', room.hostId); return; }
    const others = Object.keys(room.players).filter(id => id !== socket.id).length;
    console.log('[hostEvent]', evt.t, 'room', joinedRoom, '-> broadcasting to', others, 'players');
    socket.to(joinedRoom).emit('hostEvent', evt);
  });

  /* Cleanup on disconnect. */
  socket.on('disconnect', () => {
    if (!joinedRoom) return;
    const room = rooms[joinedRoom];
    if (!room) return;
    delete room.players[socket.id];

    if (room.hostId === socket.id) {
      // host left — end the room for everyone (host-authoritative tradeoff)
      io.to(joinedRoom).emit('roomClosed', { reason: 'Host left the game' });
      delete rooms[joinedRoom];
    } else {
      io.to(room.hostId).emit('playerLeft', { id: socket.id });
      broadcastPlayerList(joinedRoom);
    }
  });

  function broadcastPlayerList(code) {
    const room = rooms[code];
    if (!room) return;
    io.to(code).emit('playerList', {
      hostId: room.hostId,
      players: room.players
    });
  }
});

/* Keep stored player fields small and safe (faces can be big data-URLs, cap them). */
function sanitize(p) {
  p = p || {};
  let face = typeof p.face === 'string' ? p.face : null;
  if (face && face.length > 200000) face = null; // ~200KB cap on a selfie data-URL
  return {
    name: String(p.name || 'Player').slice(0, 12),
    color: String(p.color || '#4d8cff').slice(0, 9),
    face
  };
}

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Together We Rise server running on port ${PORT}`);
});