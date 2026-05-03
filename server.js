const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));
app.use(express.json());

// --- BASES DE DONNÉES EN MÉMOIRE ---
const players = new Map();
const combats = [];
const chatHistory = [];
const SECRET = 'grandline_v3_ultimate_secret';
const ADMIN_PIN = '7777';

// --- CONFIGURATION V3 ---
const GRADES = {
  pirate: [{l:'Mousse',t:0},{l:'Pirate',t:5000},{l:'Pirate Notoire',t:50000},{l:'Supernova',t:300000},{l:'Capitaine',t:1000000},{l:'Shichibukai',t:10000000},{l:'Yonko',t:100000000}],
  marine: [{l:'Matelot',t:0},{l:'Enseigne',t:10000},{l:'Lieutenant',t:50000},{l:'Capitaine',t:200000},{l:'Commodore',t:500000},{l:'Vice-Amiral',t:2000000},{l:'Amiral',t:10000000}],
  secret: [{l:'Agent Secret',t:0},{l:'Amiral de la Flotte',t:0}]
};

function calcGrade(p) {
  const list = GRADES[p.faction] || GRADES.pirate;
  const stat = p.faction === 'marine' ? p.berries : p.bounty;
  let idx = 0;
  for (let i = 0; i < list.length; i++) { if (stat >= list[i].t) idx = i; }
  p.gradeIndex = idx; p.grade = list[idx].l;
}

// --- CONNEXION & AUTHENTIFICATION ---
io.on('connection', (socket) => {
  let user = null;

  const sync = () => { if(user) socket.emit('player:update', user); broadcastOnline(); };

  socket.on('auth:register', async (data) => {
    if (players.has(data.name)) return socket.emit('auth:error', 'Nom de pirate déjà pris.');
    const hash = await bcrypt.hash(data.password, 10);
    user = {
      name: data.name, pass: hash, faction: data.faction,
      xp: 0, berries: 500, bounty: 0, wantedLevel: 0,
      stats: { trainCount: 0, pillageCount: 0, navCount: 0, combatWins: 0, combatLosses: 0, arrested: 0 },
      isJailed: false, jailUntil: null, cdUntil: 0,
      adminLevel: data.adminCode === ADMIN_PIN ? 2 : 0
    };
    calcGrade(user);
    players.set(user.name, user);
    socket.emit('auth:success', { token: jwt.sign({ n: user.name }, SECRET), player: user });
    socket.emit('chat:history', chatHistory.slice(-50));
    sync();
  });

  socket.on('auth:login', async (data) => {
    const p = players.get(data.name);
    if (!p || !(await bcrypt.compare(data.password, p.pass))) return socket.emit('auth:error', 'Identifiants invalides.');
    user = p;
    socket.emit('auth:success', { token: jwt.sign({ n: user.name }, SECRET), player: user });
    socket.emit('chat:history', chatHistory.slice(-50));
    sync();
  });

  socket.on('auth:token', (data) => {
    try {
      jwt.verify(data.token, SECRET);
      const p = players.get(data.name);
      if (p) { user = p; socket.emit('auth:success', { token: data.token, player: user }); socket.emit('chat:history', chatHistory.slice(-50)); sync(); }
    } catch(e) { socket.emit('auth:error', 'Session expirée.'); }
  });
  // --- MÉCANIQUES DE JEU ---
  const applyCooldown = (ms) => { user.cdUntil = Date.now() + ms; socket.emit('action:cooldown', ms); };

  socket.on('action:train', () => {
    if (!user || user.isJailed || Date.now() < user.cdUntil) return;
    user.xp += Math.floor(Math.random() * 50) + 20;
    user.stats.trainCount++;
    socket.emit('log:add', { type: 'success', msg: `💪 **Entraînement terminé.** Vous sentez votre force grandir.` });
    applyCooldown(3200); sync();
  });

  socket.on('action:pillage', () => {
    if (!user || user.isJailed || Date.now() < user.cdUntil) return;
    const gain = Math.floor(Math.random() * 800) + 200;
    user.berries += gain; user.bounty += Math.floor(gain / 2);
    user.stats.pillageCount++;
    if (user.wantedLevel < 3) user.wantedLevel++;
    
    // Système de prison (15% de chance si Wanted Level > 0)
    if (Math.random() < (0.05 * user.wantedLevel)) {
      user.isJailed = true;
      user.jailUntil = Date.now() + 60000; // 60s de prison
      user.stats.arrested++;
      socket.emit('log:add', { type: 'danger', msg: `🚨 **ARRÊTÉ PAR LA MARINE !** Vous perdez la moitié de vos Berrys et êtes incarcéré.` });
      user.berries = Math.floor(user.berries / 2);
    } else {
      socket.emit('log:add', { type: 'success', msg: `🏴‍☠️ **Pillage réussi !** Vous volez **${gain} ฿**.` });
    }
    calcGrade(user); applyCooldown(3200); sync();
  });

  socket.on('action:combat', ({ target }) => {
    if (!user || user.isJailed || Date.now() < user.cdUntil) return;
    const defender = players.get(target);
    if (!defender || defender.name === user.name) return socket.emit('log:add', { type: 'warn', msg: `❌ Cible introuvable ou invalide.` });

    // Calcul de combat basique V3
    const aPower = user.xp + user.bounty; const dPower = defender.xp + defender.bounty;
    const win = (Math.random() * aPower) > (Math.random() * dPower);
    
    const cData = {
      createdAt: Date.now(), attacker: user.name, defender: defender.name,
      winner: win ? user.name : defender.name, bountyGained: win ? Math.floor(defender.bounty * 0.1) : 0,
      narrative: [`${user.name} attaque sauvagement ${defender.name} !`, win ? `**${user.name}** écrase son adversaire !` : `**${defender.name}** repousse l'attaque avec brio !`]
    };
    
    combats.push(cData);
    if (win) { user.stats.combatWins++; defender.stats.combatLosses++; user.bounty += cData.bountyGained; } 
    else { user.stats.combatLosses++; defender.stats.combatWins++; defender.bounty += Math.floor(user.bounty * 0.1); }
    
    calcGrade(user); calcGrade(defender);
    socket.emit('log:add', { type: 'combat', msg: `⚔️ Vous avez attaqué **${defender.name}** ! Résultat : ${win ? 'VICTOIRE' : 'DÉFAITE'}.` });
    applyCooldown(4000); sync(); updateLeaderboard();
  });

  socket.on('action:release', () => {
    if (user && user.isJailed && Date.now() >= user.jailUntil) {
      user.isJailed = false; user.jailUntil = null; user.wantedLevel = 0;
      socket.emit('log:add', { type: 'info', msg: `🔓 Vous êtes libéré. Essayez de rester discret.` });
      sync();
    }
  });
  // --- CHAT & ADMIN ---
  socket.on('chat:send', ({ text, channel }) => {
    if (!user) return;
    const msg = { author: user.name, text, faction: user.faction, isSystem: false, createdAt: Date.now() };
    chatHistory.push(msg);
    if (channel === 'global') io.emit('chat:message', msg);
    // Filtrage Faction simple
    else Array.from(io.sockets.sockets.values()).forEach(s => {
       if(s.userFaction === user.faction) s.emit('chat:message', msg);
    });
  });

  socket.on('admin:action', ({ action, target, value, code }) => {
    if (!user || user.adminLevel < 2 || code !== ADMIN_PIN) return socket.emit('log:add', { type: 'danger', msg: 'Accès refusé.' });
    if (action === 'broadcast') {
      const bMsg = { author: 'SYSTÈME', text: value, isSystem: true, createdAt: Date.now() };
      chatHistory.push(bMsg); io.emit('chat:message', bMsg); return;
    }
    const t = players.get(target);
    if (!t) return socket.emit('log:add', { type: 'warn', msg: 'Joueur introuvable.' });
    
    if (action === 'setBounty') t.bounty = parseInt(value) || 0;
    if (action === 'setBerries') t.berries = parseInt(value) || 0;
    if (action === 'release') { t.isJailed = false; t.jailUntil = null; t.wantedLevel = 0; }
    if (action === 'resetStats') { t.xp = 0; t.stats = { trainCount: 0, pillageCount: 0, navCount: 0, combatWins: 0, combatLosses: 0, arrested: 0 }; }
    
    calcGrade(t); updateLeaderboard();
    socket.emit('log:add', { type: 'success', msg: `🔧 Admin: ${action} appliqué sur ${target}.` });
  });

  socket.on('disconnect', () => { broadcastOnline(); });
});

// --- ROUTES & BROADCASTS ---
function updateLeaderboard() {
  const list = Array.from(players.values()).sort((a, b) => b.bounty - a.bounty).slice(0, 50).map(p => ({ name: p.name, grade: p.grade, bounty: p.bounty, faction: p.faction }));
  io.emit('leaderboard:update', list);
}

function broadcastOnline() {
  const users = Array.from(io.sockets.sockets.values()).map(s => s.id); // Simplification pour count
  io.emit('online:update', users);
  updateLeaderboard();
}

app.get('/api/combats', (req, res) => res.json(combats.slice(-20))); // API attendue par le client V3

server.listen(3000, () => console.log('☠️ Serveur RPG V3 opérationnel sur le port 3000.'));
