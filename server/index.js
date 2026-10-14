const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const lobbyLib = require('./lobby');
const round = require('./round');
const game = require('./game');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
round.init(io);

app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/health', (req, res) => res.send('ok'));

function broadcast(lobby) {
  io.to(lobby.code).emit('lobbyUpdate', lobbyLib.toPublic(lobby));
}

function removeFromLobby(socket) {
  const code = lobbyLib.getLobbyCode(socket.id);
  const lobby = lobbyLib.leaveLobby(socket.id);
  if (code) socket.leave(code);
  if (lobby) {
    round.playerLeft(lobby, socket.id);   // may end the round
    broadcast(lobby);
  }
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('createLobby', (name, cb) => {
    removeFromLobby(socket);
    const lobby = lobbyLib.createLobby(socket.id, name);
    socket.join(lobby.code);
    if (typeof cb === 'function') cb({ ok: true });
    broadcast(lobby);
  });

  socket.on('joinLobby', (code, name, cb) => {
    removeFromLobby(socket);
    const result = lobbyLib.joinLobby(socket.id, code, name);
    if (result.error) {
      if (typeof cb === 'function') cb({ error: result.error });
      return;
    }
    socket.join(result.lobby.code);
    if (typeof cb === 'function') cb({ ok: true });
    broadcast(result.lobby);
  });

  socket.on('updateSettings', (changes) => {
    const lobby = lobbyLib.updateSettings(socket.id, changes);
    if (lobby) broadcast(lobby);
  });

  socket.on('setMap', (mapKey) => {
    const lobby = lobbyLib.setMap(socket.id, mapKey);
    if (lobby) broadcast(lobby);
  });

  // ----- Rounds -----
  socket.on('startGame', (cb) => {
    const result = round.startRound(socket.id);
    if (typeof cb === 'function') cb(result);
  });

  socket.on('chooseEntity', (entity, color) => round.chooseEntity(socket.id, entity, color));
  socket.on('pickItems', (items) => round.pickItems(socket.id, items));
  socket.on('input', (input) => game.setInput(socket.id, input));
  socket.on('shoot', (angle) => game.shoot(socket.id, angle));
  socket.on('useItem', (index) => game.useItem(socket.id, index));
  socket.on('sling', (angle) => game.sling(socket.id, angle));

  socket.on('leaveLobby', () => removeFromLobby(socket));

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    removeFromLobby(socket);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Game server running on port ${PORT}`);
});