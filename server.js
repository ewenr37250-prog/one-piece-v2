require('dotenv').config();
const express = require('express');
const path    = require('path');
const http    = require('http');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

// Configuration des accès (Utilise les variables d'environnement ou les défauts)
const CODES = {
  master: process.env.CODE_MASTER || 'TartifletteDeLaHess',
  super:  process.env.CODE_SUPER  || 'Tartiflette',
  admin:  process.env.CODE_ADMIN  || 'RedaLeGoat'
};

app.use(express.static(path.join(__dirname, 'public')));

let players    = {};
let worldEvent = "⛵ L'horizon est dégagé... les mers vous attendent.";

io.on('connection', (socket) => {
  socket.emit('init', { worldEvent, players });

  socket.on('join', ({ name, faction }) => {
    socket.playerName = name;
    if (!players[name]) {
      players[name] = { 
        name, faction, bounty: 1000, gradeXP: 0, skillPoints: 0, 
        skills: { force: 0, intel: 0, haki: 0, reading: 0 },
        grade: "Mousse" 
      };
    }
    io.emit('leaderboard-update', players);
    socket.emit('player-data', players[name]);
  });

  socket.on('rp-message', ({ user, text }) => {
    if (!players[user]) return;
    // Progression de la prime
    players[user].bounty += Math.floor(Math.random() * 200) + 100;
    players[user].gradeXP += 10;
    
    io.emit('rp-message', { user, text, faction: players[user].faction });
    io.emit('leaderboard-update', players);
    socket.emit('player-data', players[user]);
  });

  // --- MATIÈRE BRUTE : HAKI DES ROIS ---
  socket.on('use-haki', ({ user, code }) => {
    const lvl = getLevel(code);
    if (lvl === 'master' || lvl === 'supermodo' || (players[user] && players[user].skills.haki >= 5)) {
      io.emit('haki-vibe', { user });
    }
  });

  socket.on('admin-action', ({ type, value, target, code }) => {
    const lvl = getLevel(code);
    if (!lvl) return;

    if (type === 'event' && (lvl === 'master' || lvl === 'supermodo')) {
      worldEvent = value;
      io.emit('world-event-update', value);
    }
    
    if (type === 'kick' && lvl === 'master') {
        io.emit('system-msg', `🚫 ${target} a été banni des mers.`);
        delete players[target];
        io.emit('leaderboard-update', players);
    }
  });

  socket.on('send-poster', ({ targetName, imageUrl, code }) => {
    const lvl = getLevel(code);
    if (lvl === 'master' || lvl === 'supermodo') {
      const p = players[targetName];
      if (p) {
        io.emit('show-poster', { targetName, imageUrl, bounty: p.bounty, faction: p.faction });
      }
    }
  });

  socket.on('admin-auth', (code, cb) => {
    const lvl = getLevel(code);
    cb(lvl ? { level: lvl } : false);
  });
});

function getLevel(code) {
  if (code === CODES.master) return 'master';
  if (code === CODES.super)  return 'supermodo';
  if (code === CODES.admin)  return 'admin';
  return null;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚢 Horizon V3.2 prêt sur le port ${PORT}`));
