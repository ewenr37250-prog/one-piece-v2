'use strict';
require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Server } = require('socket.io');
const { Player, CombatLog, Message } = require('./models');
const combat = require('./combat');

const PORT = process.env.PORT || 3000;
const ADMIN_CODE = process.env.ADMIN_CODE || 'OP2026';
const ACTION_CD = 3000;
const onlineMap = new Map();
const nameToSock = new Map();
const cdMap = new Map();
const chatCache = [];

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

mongoose.connect(process.env.MONGODB_URI).then(() => console.log('[DB] ✅ MongoDB connecté'));

app.use(express.static(path.join(__dirname, 'public')));

const sysMsg = (text) => {
  const m = { author: 'SYSTÈME', faction: 'system', text, channel: 'global', isSystem: true, createdAt: new Date() };
  chatCache.push(m);
  if (chatCache.length > 100) chatCache.shift();
  io.emit('chat:message', m);
};

async function broadcastLeaderboard() {
  const rows = await Player.find({ isBanned: false }).select('name faction bounty berries grade gradeIndex isTraitor').sort({ bounty: -1 }).limit(25).lean();
  io.emit('leaderboard:update', rows);
  io.emit('online:update', [...onlineMap.values()]);
}

io.on('connection', (socket) => {
  socket.emit('chat:history', chatCache.slice(-50));

  socket.on('auth:register', async ({ name, password, faction, adminCode }) => {
    const isAdmin = faction === 'secret' && adminCode === ADMIN_CODE;
    const player = new Player({
      name: name.trim(),
      passwordHash: await bcrypt.hash(password, 10),
      faction: isAdmin ? 'secret' : (faction || 'pirate'),
      adminLevel: isAdmin ? 3 : 0,
      sessionToken: crypto.randomBytes(32).toString('hex')
    });
    player.refreshGrade();
    await player.save();
    _connectPlayer(socket, player, player.sessionToken);
  });

  socket.on('auth:login', async ({ name, password }) => {
    const p = await Player.findOne({ name: name.trim() });
    if (p && await p.checkPassword(password)) {
      p.sessionToken = crypto.randomBytes(32).toString('hex');
      await p.save();
      _connectPlayer(socket, p, p.sessionToken);
    }
  });

  socket.on('action:betray', async () => {
    const p = await Player.findOne({ name: socket.playerName });
    if (!p || p.isJailed || p.isTraitor) return;
    p.bounty *= 0.5; p.berries *= 0.5; p.isTraitor = true;
    p.traitorUntil = new Date(Date.now() + 86400000);
    p.faction = (p.faction === 'marine') ? 'revolutionnaire' : 'pirate';
    p.refreshGrade(); await p.save();
    _connectPlayer(socket, p, p.sessionToken); // Rafraîchit les flags
    sysMsg(`⚖️ **TRAHISON :** ${p.name} a déserté pour rejoindre les ${p.faction}s !`);
  });

  socket.on('chat:send', async ({ text, channel }) => {
    const p = await Player.findOne({ name: socket.playerName });
    if (!p || p.isMuted) return;
    if (p.isTraitor && channel !== 'global') return;

    const msg = { author: p.name, faction: p.faction, text, channel: channel || 'global', isTraitor: p.isTraitor, createdAt: new Date() };
    
    [...io.sockets.sockets.values()].filter(s => {
      if (s.playerIsTraitor && msg.channel !== 'global') return false;
      if (msg.channel === 'global') return true;
      if (s.playerFaction === 'secret') return true;
      return s.playerFaction === msg.channel;
    }).forEach(s => s.emit('chat:message', msg));
  });

  // Actions de base (Train, Pillage, Navigate) à garder identiques à ta V3...
  socket.on('action:train', async () => { /* ...ta logique train... */ });
  socket.on('action:pillage', async () => { /* ...ta logique pillage... */ });
  socket.on('action:navigate', async () => { /* ...ta logique navigate... */ });

  socket.on('disconnect', () => {
    onlineMap.delete(socket.id);
    broadcastLeaderboard();
  });
});

async function _connectPlayer(socket, player, token) {
  // Nettoyage automatique du statut traître
  if (player.isTraitor && player.traitorUntil && new Date() > player.traitorUntil) {
    player.isTraitor = false; player.traitorUntil = null; player.refreshGrade(); await player.save();
  }
  socket.playerName = player.name;
  socket.playerFaction = player.faction;
  socket.playerIsTraitor = player.isTraitor;
  onlineMap.set(socket.id, { name: player.name, faction: player.faction, isTraitor: player.isTraitor });
  socket.emit('auth:success', { token, player: combat.sanitize(player) });
  broadcastLeaderboard();
}

server.listen(PORT, () => console.log(`⚓ V2 LANCEE : http://localhost:${PORT}`));
