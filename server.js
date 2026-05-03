const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const SECRET = process.env.JWT_SECRET || 'grandline_secret_key';
const ADMIN_CODE = process.env.ADMIN_CODE || 'OP2024';

// Bases de données en mémoire (à coupler avec MongoDB pour persister)
const players = new Map();
const combats = [];
const chatHistory = [];

// Grades officiels extraits de ton code [cite: 50]
const GRADES = {
  pirate: [{l:'Mousse',t:0},{l:'Pirate',t:5000},{l:'Pirate Notoire',t:50000},{l:'Supernova',t:300000},{l:'Capitaine',t:1000000},{l:'Shichibukai',t:10000000},{l:'Yonko',t:100000000}],
  marine: [{l:'Matelot',t:0},{l:'Enseigne',t:10000},{l:'Lieutenant',t:50000},{l:'Capitaine',t:200000},{l:'Commodore',t:500000},{l:'Vice-Amiral',t:2000000},{l:'Amiral',t:10000000}]
};

function updateGrade(p) {
  const list = GRADES[p.faction] || GRADES.pirate;
  const stat = p.faction === 'marine' ? p.berries : p.bounty;
  let newIdx = 0;
  for (let i = 0; i < list.length; i++) {
    if (stat >= list[i].t) newIdx = i;
  }
  p.gradeIndex = newIdx;
  p.grade = list[newIdx].l;
}

io.on('connection', (socket) => {
  let user = null;

  const sync = () => { if(user) socket.emit('player:update', user); sendLeaderboard(); };

  // --- AUTHENTIFICATION ---
  socket.on('auth:register', async (data) => {
    if (players.has(data.name)) return socket.emit('auth:error', 'Nom déjà pris.');
    const hashed = await bcrypt.hash(data.password, 10);
    user = {
      name: data.name, pass: hashed, faction: data.faction,
      xp: 0, berries: 1000, bounty: 0, wantedLevel: 0,
      grade: GRADES[data.faction][0].l, gradeIndex: 0,
      stats: { trainCount: 0, pillageCount: 0, navCount: 0, combatWins: 0, combatLosses: 0, arrested: 0 },
      isJailed: false, jailUntil: null, adminLevel: data.adminCode === ADMIN_CODE ? 2 : 0
    };
    players.set(user.name, user);
    const token = jwt.sign({ name: user.name }, SECRET);
    socket.emit('auth:success', { token, player: user });
    sync();
  });

  socket.on('auth:login', async (data) => {
    const p = players.get(data.name);
    if (!p || !(await bcrypt.compare(data.password, p.pass))) return socket.emit('auth:error', 'Identifiants invalides.');
    user = p;
    const token = jwt.sign({ name: user.name }, SECRET);
    socket.emit('auth:success', { token, player: user });
    sync();
  });

  // --- ACTIONS [cite: 80, 81] ---
  socket.on('action:train', () => {
    if (!user || user.isJailed) return;
    user.xp += 50;
    user.stats.trainCount++;
    socket.emit('log:add', { type: 'success', msg: `💪 Entraînement terminé. **+50 XP**` });
    sync();
  });

  socket.on('action:pillage', () => {
    if (!user || user.isJailed) return;
    const gain = Math.floor(Math.random() * 500) + 100;
    user.berries += gain;
    user.bounty += 150;
    user.stats.pillageCount++;
    if (user.wantedLevel < 3) user.wantedLevel++;
    
    // Chance d'arrestation (Marine)
    if (Math.random() < 0.15) {
      user.isJailed = true;
      user.jailUntil = Date.now() + 30000;
      socket.emit('log:add', { type: 'danger', msg: `🚨 **ARRÊTÉ !** Vous avez été envoyé à Impel Down.` });
    } else {
      socket.emit('log:add', { type: 'success', msg: `🏴‍☠️ Pillage réussi ! **+${gain} Berrys**` });
    }
    updateGrade(user);
    sync();
  });

  socket.on('action:release', () => {
    if (user && user.isJailed && Date.now() >= user.jailUntil) {
      user.isJailed = false;
      user.jailUntil = null;
      user.wantedLevel = 0;
      socket.emit('log:add', { type: 'info', msg: `🔓 Vous êtes libre. Ne recommencez pas !` });
      sync();
    }
  });

  // --- SYSTÈME DE CHAT [cite: 84, 87] ---
  socket.on('chat:send', (data) => {
    if (!user) return;
    const msg = { author: user.name, text: data.text, faction: user.faction, createdAt: new Date() };
    chatHistory.push(msg);
    io.emit('chat:message', msg);
  });
});

function sendLeaderboard() {
  const list = Array.from(players.values())
    .sort((a, b) => b.bounty - a.bounty)
    .slice(0, 10)
    .map(p => ({ name: p.name, bounty: p.bounty, grade: p.grade, faction: p.faction }));
  io.emit('leaderboard:update', list);
}

app.get('/api/combats', (req, res) => res.json(combats.slice(-10)));

server.listen(3000, () => console.log('⚓ One Piece V3 : Opérationnelle sur le port 3000'));
