require('dotenv').config();
const express = require('express');
const path    = require('path');
const app     = express();
const server  = require('http').createServer(app);
const io      = require('socket.io')(server, { cors: { origin: '*' } });

const players  = {};
const history  = [];
let worldEvent = null;

const quests = [
  { id:1, title:'Traversée du Grand Line',  desc:'Rédigez 3 posts RP.',             faction:'all',    reward:500000,  done:[] },
  { id:2, title:'Chasse à la Prime',         desc:'Impliquez-vous dans un combat.',  faction:'pirate', reward:2000000, done:[] },
  { id:3, title:'Ordre du Monde',             desc:'Rédigez un post d\'arrestation.', faction:'marine', reward:0, xpReward:30, done:[] },
  { id:4, title:'Flamme de la Liberté',      desc:'Recrutez un allié narratif.',     faction:'revo',    reward:0, infReward:20, done:[] },
  { id:5, title:'Îles Inconnues',            desc:'Créez un nouvel arc RP.',         faction:'all',    reward:1000000, done:[] }
];

const ADMIN_CODE = process.env.ADMIN_CODE || 'RedaLeGoat';

const FACTION_GRADES = {
  pirate: ['Mousse','Matelot','Second','Capitaine','Commodore','Amiral de flotte'],
  marine: ['Recrue','Soldat','Sergent','Lieutenant','Capitaine','Vice-amiral','Amiral'],
  revo:   ['Partisan','Agent','Chef de cellule','Officier','Commandant','Général']
};

const WORLD_EVENTS = [
  { title:'⚔️ Bataille de Marineford', desc:'Conflit épique entre Pirates et Marine !',        goal:15, reward:5000000 },
  { title:'🏝️ Île Mystérieuse',        desc:'Une île inconnue apparaît. Explorez en RP !',   goal:10, reward:3000000 },
  { title:'🏛️ La Reverie',             desc:'Sommet des rois. Intrigues et diplomatie !',      goal:8,  reward:4000000 },
  { title:'🌊 Tempête du Grand Line',  desc:'Survie collective — collaborez !',                goal:12, reward:2000000 },
  { title:'🐉 Créature des Abysses',  desc:'Monstre légendaire ! Unissez-vous !',              goal:20, reward:8000000 },
  { title:'⚓ Chasse aux Empereurs',  desc:'La Marine lance une opération majeure.',             goal:25, reward:10000000 }
];

// --- CORRECTION DU CHEMIN ICI ---
app.use(express.static(__dirname)); 
app.get('*', (_, res) => res.sendFile(path.resolve(__dirname, 'index.html')));
// --------------------------------

io.on('connection', (socket) => {
  console.log('[+] Connexion:', socket.id);

  socket.emit('init', { history, players, quests, worldEvent });

  socket.on('join', ({ name, faction }) => {
    socket.playerName    = name;
    socket.playerFaction = faction;
    if (!players[name]) {
      players[name] = {
        bounty:0, influence:0, gradeXP:0, gradeIdx:0,
        grade: FACTION_GRADES[faction]?.[0] || 'Recrue',
        faction
      };
    }
    socket.emit('player-data', players[name]);
    io.emit('player-list', players);
    io.emit('system-message', `🌊 ${name} (${faction}) a rejoint les mers !`);
  });

  socket.on('rp-message', ({ user, text, channel }) => {
    const msg = { user, text, channel: channel || 'rp', ts: Date.now() };
    history.push(msg);
    if (history.length > 100) history.shift();
    io.emit('rp-message', msg);

    if (worldEvent?.active && !worldEvent.contributors.includes(user)) {
      worldEvent.contributors.push(user);
      worldEvent.progress++;
      io.emit('event-update', worldEvent);
      if (worldEvent.progress >= worldEvent.goal) {
        worldEvent.active = false;
        io.emit('event-completed', worldEvent);
        io.emit('system-message', `🎉 ÉVÉNEMENT "${worldEvent.title}" TERMINÉ ! Récompenses distribuées !`);
        worldEvent.contributors.forEach(n => {
          if (players[n]) {
            players[n].bounty += worldEvent.reward;
            io.emit('bounty-updated', { target: n, amount: players[n].bounty });
          }
        });
      }
    }

    if (players[user]) {
      const p = players[user];
      if (p.faction === 'pirate')  p.bounty    += 500000;
      if (p.faction === 'marine')  p.gradeXP   += 12;
      if (p.faction === 'revo')    p.influence += 4;
      p.gradeXP = (p.gradeXP || 0) + 10;
      checkGrade(user);
      socket.emit('player-data', players[user]);
    }
  });

  socket.on('admin-auth', (code, cb) => cb(code === ADMIN_CODE));

  socket.on('admin-update-bounty', ({ target, amount }) => {
    if (players[target]) {
      players[target].bounty = Number(amount);
      io.emit('bounty-updated', { target, amount: Number(amount) });
      io.emit('system-message', `⚠️ AVIS DE RECHERCHE : La prime de ${target} est désormais de ${fmtB(Number(amount))} !`);
    }
  });

  socket.on('admin-announcement', (text) => {
    io.emit('global-alert', text);
    history.push({ user:'📢 JOURNAL', text, channel:'rp', ts:Date.now() });
    io.emit('rp-message', { user:'📢 JOURNAL', text, channel:'rp', ts:Date.now() });
  });

  socket.on('admin-trigger-event', (idx) => {
    const tmpl = WORLD_EVENTS[idx] || WORLD_EVENTS[0];
    worldEvent = { ...tmpl, active:true, progress:0, contributors:[], startedAt:Date.now() };
    io.emit('event-started', worldEvent);
    io.emit('system-message', `⚡ ÉVÉNEMENT MONDIAL : "${worldEvent.title}" — ${worldEvent.desc}`);
  });

  socket.on('admin-end-event', () => {
    if (worldEvent) worldEvent.active = false;
    io.emit('event-update', worldEvent);
    worldEvent = null;
    io.emit('system-message', '🏁 L\'événement mondial a été terminé par l\'administration.');
  });

  socket.on('admin-set-grade', ({ target, grade }) => {
    if (players[target]) {
      players[target].grade = grade;
      io.emit('player-list', players);
      io.emit('system-message', `📋 ${target} a été promu(e) : ${grade}`);
    }
  });

  socket.on('admin-kick', (target) => {
    const s = [...io.sockets.sockets.values()].find(x => x.playerName === target);
    if (s) { s.emit('kicked'); s.disconnect(); }
    delete players[target];
    io.emit('player-list', players);
    io.emit('system-message', `🚫 ${target} a été expulsé(e).`);
  });

  socket.on('admin-reset-bounty', (target) => {
    if (players[target]) {
      players[target].bounty = 0;
      players[target].gradeXP = 0;
      players[target].influence = 0;
      io.emit('player-list', players);
      io.emit('bounty-updated', { target, amount: 0 });
      io.emit('system-message', `🔄 Stats de ${target} réinitialisées.`);
    }
  });

  socket.on('quest-complete', ({ user, questId }) => {
    const q = quests.find(x => x.id === questId);
    if (!q || q.done.includes(user)) return;
    q.done.push(user);
    if (players[user]) {
      if (q.reward)    players[user].bounty    += q.reward;
      if (q.xpReward)  players[user].gradeXP   += q.xpReward;
      if (q.infReward) players[user].influence  += q.infReward;
      checkGrade(user);
      const s = [...io.sockets.sockets.values()].find(x => x.playerName === user);
      s?.emit('player-data', players[user]);
    }
    io.emit('system-message', `✅ ${user} a accompli la quête "${q.title}" !`);
    io.emit('quest-update', quests);
  });

  socket.on('disconnect', () => {
    if (socket.playerName) {
      io.emit('system-message', `👋 ${socket.playerName} a quitté les mers.`);
      io.emit('player-list', players);
    }
  });
});

function checkGrade(name) {
  const p = players[name];
  if (!p) return;
  const grades = FACTION_GRADES[p.faction] || [];
  const thresholds = [0,50,150,350,700,1200,2000];
  const nextXP = thresholds[(p.gradeIdx||0) + 1];
  if (nextXP && p.gradeXP >= nextXP && (p.gradeIdx||0) + 1 < grades.length) {
    p.gradeIdx++;
    p.grade = grades[p.gradeIdx];
    io.emit('system-message', `🎉 ${name} vient d'être promu(e) : ${p.grade} !`);
    io.emit('player-list', players);
  }
}

function fmtB(n) {
  if (n >= 1e9) return (n/1e9).toFixed(2) + 'Md ฿';
  if (n >= 1e6) return (n/1e6).toFixed(0) + 'M ฿';
  if (n >= 1e3) return (n/1e3).toFixed(0) + 'k ฿';
  return n + ' ฿';
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`[SERVER] http://localhost:${PORT}`));
