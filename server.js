require('dotenv').config();
const express = require('express');
const path    = require('path');
const http    = require('http');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

const CODES = {
  master: process.env.CODE_MASTER || 'TartifletteDeLaHess',
  super:  process.env.CODE_SUPER  || 'Tartiflette',
  admin:  process.env.CODE_ADMIN  || 'RedaLeGoat'
};

let players    = {};
let worldEvent = "⛵ L'horizon est dégagé... les mers vous attendent.";
let msgHistory = []; 

const SKILL_COSTS = { force: 1, intel: 1, haki: 3, reading: 10 };
const FACTION_GRADES = {
  pirate: ['Mousse','Matelot','Second','Capitaine','Commodore','Amiral de flotte'],
  marine: ['Recrue','Soldat','Sergent','Lieutenant','Vice-Amiral','Amiral Chef'],
  revo:   ['Initié','Agent','Cadre','Commandant','Chef de corps','Chef suprême']
};

// --- LA CORRECTION GEMINI POUR ÉVITER L'ERREUR ---
app.use(express.static(__dirname)); 
app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  socket.emit('init', { worldEvent, players, history: msgHistory });

  socket.on('join', ({ name, faction }) => {
    if (!name || name.length < 2) return;
    socket.playerName = name;
    if (!players[name]) {
      players[name] = {
        name, faction, bounty: 1000, gradeXP: 0, gradeIdx: 0,
        grade: FACTION_GRADES[faction][0], skillPoints: 0,
        skills: { force: 0, intel: 0, haki: 0, reading: 0 },
        connected: true
      };
    }
    io.emit('leaderboard-update', players);
    socket.emit('player-data', players[name]);
  });

  socket.on('rp-message', ({ user, text }) => {
    if (!players[user] || !text) return;
    const p = players[user];
    p.bounty += Math.floor(Math.random() * 300) + 150;
    p.gradeXP += 10;
    
    const msg = { user, text, faction: p.faction, time: new Date() };
    msgHistory.push(msg);
    if (msgHistory.length > 100) msgHistory.shift();
    io.emit('rp-message', msg);
    io.emit('leaderboard-update', players);
    socket.emit('player-data', p);
  });

  socket.on('admin-auth', (code, cb) => {
    const lvl = getLevel(code);
    cb(lvl ? { level: lvl } : false);
  });

  socket.on('admin-action', ({ type, value, target, code }) => {
    const lvl = getLevel(code);
    if (!lvl) return;
    if (type === 'event') { worldEvent = value; io.emit('world-event-update', value); }
    if (type === 'kick' && target) { delete players[target]; io.emit('leaderboard-update', players); }
  });
});

function getLevel(code) {
  if (code === CODES.master) return 'master';
  if (code === CODES.super)  return 'supermodo';
  if (code === CODES.admin)  return 'admin';
  return null;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`⚓ Horizon V3 lancé sur le port ${PORT}`));
