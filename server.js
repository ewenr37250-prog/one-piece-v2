require('dotenv').config();
const express = require('express');
const path    = require('path');
const http    = require('http');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

// ── Codes d'accès (modifiables via .env) ─────────────────
const CODES = {
  master: process.env.CODE_MASTER || 'TartifletteDeLaHess',
  super:  process.env.CODE_SUPER  || 'Tartiflette',
  admin:  process.env.CODE_ADMIN  || 'RedaLeGoat'
};

// ── Données en mémoire ────────────────────────────────────
// Note : Railway/Render ont un filesystem éphémère.
// Les données sont gardées EN MÉMOIRE pendant la session.
// Pour la persistance, utiliser une DB externe (MongoDB Atlas gratuit).
let players    = {};
let worldEvent = "⛵ L'horizon est dégagé... les mers vous attendent.";
let msgHistory = []; // 100 derniers messages

const SKILL_COSTS = { force: 1, intel: 1, haki: 3, reading: 10 };
const FACTION_COLORS = { pirate: '#ff4757', marine: '#2e86de', revo: '#2ed573' };

const FACTION_GRADES = {
  pirate: ['Mousse','Matelot','Second','Capitaine','Commodore','Amiral de flotte'],
  marine: ['Recrue','Soldat','Sergent','Lieutenant','Vice-Amiral','Amiral Chef'],
  revo:   ['Initié','Agent','Cadre','Commandant','Chef de corps','Chef suprême']
};

app.use(express.static(path.join(__dirname, 'public')));

// ── SOCKET.IO ─────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`⚓ Nouveau marin : ${socket.id}`);

  // Envoi état initial
  socket.emit('init', {
    worldEvent,
    players,
    history: msgHistory
  });

  // Relever le défi (Rejoindre)
  socket.on('join', ({ name, faction }) => {
    if (!name || name.length < 2) return;
    socket.playerName = name;
    
    if (!players[name]) {
      players[name] = {
        name,
        faction,
        bounty: 1000,
        gradeXP: 0,
        gradeIdx: 0,
        grade: FACTION_GRADES[faction][0],
        skillPoints: 0,
        skills: { force: 0, intel: 0, haki: 0, reading: 0 },
        connected: true
      };
    } else {
      players[name].connected = true;
    }

    io.emit('system-msg', `📢 **${name}** a rejoint la faction **${faction.toUpperCase()}**.`);
    io.emit('leaderboard-update', players);
    socket.emit('player-data', players[name]);
  });

  // Message RP
  socket.on('rp-message', ({ user, text }) => {
    if (!players[user] || !text) return;
    const p = players[user];

    // Gain de prime / XP
    p.bounty += Math.floor(Math.random() * 300) + 150;
    p.gradeXP += 10;
    
    // Check Grade / Skill Points
    checkGrade(user);

    const msg = { user, text, faction: p.faction, time: new Date() };
    msgHistory.push(msg);
    if (msgHistory.length > 100) msgHistory.shift();

    io.emit('rp-message', msg);
    io.emit('leaderboard-update', players);
    socket.emit('player-data', p);
  });

  // Skills
  socket.on('upgrade-skill', (skill) => {
    const p = players[socket.playerName];
    if (!p || !SKILL_COSTS[skill]) return;
    
    const cost = SKILL_COSTS[skill];
    if (p.skillPoints >= cost) {
      p.skillPoints -= cost;
      p.skills[skill]++;
      socket.emit('player-data', p);
    }
  });

  // ADMIN ACTIONS
  socket.on('admin-action', ({ type, value, target, code }) => {
    const lvl = getLevel(code);
    if (!lvl) return;

    if (type === 'event' && (lvl === 'master' || lvl === 'supermodo')) {
      worldEvent = value;
      io.emit('world-event-update', value);
      io.emit('system-msg', `⚠️ **ALERTE :** ${value}`);
    }

    if (type === 'kick' && lvl === 'master' && target) {
      if (players[target]) {
        delete players[target];
        io.emit('leaderboard-update', players);
        io.emit('system-msg', `🚫 ${target} a été banni par le Master.`);
      }
    }

    if (type === 'trigger-event' && lvl !== 'admin') {
      const events = [
        "Un Buster Call est en cours !",
        "Un Fruit du Démon est apparu sur l'île de Drum !",
        "Une tempête frappe Grand Line, les primes doublent !",
        "Un navire marchand a été repéré."
      ];
      worldEvent = events[value] || worldEvent;
      io.emit('world-event-update', worldEvent);
    }
  });

  socket.on('admin-auth', (code, cb) => {
    const lvl = getLevel(code);
    cb(lvl ? { level: lvl } : false);
  });

  socket.on('send-poster', ({ targetName, imageUrl, code }) => {
    const lvl = getLevel(code);
    if (!lvl || lvl === 'admin') return; // admin ne peut pas envoyer de poster
    const p = players[targetName];
    if (!p) return;
    io.emit('show-poster', {
      targetName,
      imageUrl,
      bounty:  p.bounty,
      faction: p.faction,
      grade:   p.grade
    });
  });

  // ── DISCONNECT ───────────────────────────────────────
  socket.on('disconnect', () => {
    if (socket.playerName) {
      io.emit('system-msg', `👋 ${socket.playerName} a quitté les mers.`);
      io.emit('leaderboard-update', players);
    }
  });
});

// ── Helpers ───────────────────────────────────────────────
function getLevel(code) {
  if (code === CODES.master) return 'master';
  if (code === CODES.super)  return 'supermodo';
  if (code === CODES.admin)  return 'admin';
  return null;
}

function checkGrade(name) {
  const p = players[name];
  if (!p) return;
  const grades     = FACTION_GRADES[p.faction] || [];
  const thresholds = [0, 100, 300, 700, 1500, 3000, 6000];
  const nextXP     = thresholds[(p.gradeIdx || 0) + 1];
  if (nextXP && p.gradeXP >= nextXP && (p.gradeIdx || 0) + 1 < grades.length) {
    p.gradeIdx++;
    p.grade = grades[p.gradeIdx];
    p.skillPoints += 1;
    // Animation ou notification ?
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Serveur Horizon lancé sur le port ${PORT}`));
