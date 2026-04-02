'use strict';
require('dotenv').config();

const express    = require('express');
const http       = require('http');
const path       = require('path');
const mongoose   = require('mongoose');
const bcrypt     = require('bcryptjs');
const crypto     = require('crypto');
const { Server } = require('socket.io');

const { Player, CombatLog, Message } = require('./models');
const combat = require('./combat');

// ══════════════════════════════════════════════════════════
//  CONFIG
// ══════════════════════════════════════════════════════════
const PORT        = process.env.PORT        || 3000;
const MONGO_URI   = process.env.MONGODB_URI || '';
const ADMIN_CODE  = process.env.ADMIN_CODE  || 'OP2026';
const ACTION_CD   = 3000;   // cooldown actions (ms) côté serveur
const MAX_LOG_MSG = 100;    // messages chat conservés en mémoire

// ══════════════════════════════════════════════════════════
//  DB — zéro crash, reconnexion automatique
// ══════════════════════════════════════════════════════════
let dbReady = false;

async function connectDB() {
  if (!MONGO_URI) {
    console.warn('[DB] ⚠️  MONGODB_URI absent — fonctionnement sans persistance');
    return;
  }
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS:          45000,
      maxPoolSize:              10,
    });
    dbReady = true;
    console.log('[DB] ✅ MongoDB connecté');
  } catch (e) {
    console.error('[DB] ❌', e.message, '— retry dans 10s');
    setTimeout(connectDB, 10_000);
  }
}
mongoose.connection.on('disconnected', () => {
  dbReady = false;
  console.warn('[DB] Déconnecté — retry dans 5s');
  setTimeout(connectDB, 5_000);
});
mongoose.connection.on('reconnected', () => {
  dbReady = true;
  console.log('[DB] ✅ Reconnecté');
});

// ══════════════════════════════════════════════════════════
//  NAVIGATION — événements aléatoires
// ══════════════════════════════════════════════════════════
const NAV_EVENTS = [
  { msg:'🌤️ Mer calme. Vous progressez sans encombre.',              berries:  500, bounty:    0, type:'info' },
  { msg:'🚢 Navire marchand croisé ! Vous récupérez des provisions.', berries: 5000, bounty:  200, type:'success' },
  { msg:'⛈️ Tempête sur le Grand Line. Dégâts matériels.',            berries:-1000, bounty:    0, type:'warn' },
  { msg:'🐳 Sealord à tribord ! Vous survivez de justesse.',          berries:-2000, bounty:  500, type:'warn' },
  { msg:'🗺️ Île mystérieuse ! Vous trouvez un trésor enfoui.',        berries: 8000, bounty:    0, type:'success' },
  { msg:'⚓ Sous-marin de la Marine repéré. Fuite à toute vitesse !', berries:    0, bounty: 1000, type:'warn' },
  { msg:'🌊 Calme plat. Vous pêchez pour passer le temps.',           berries:  200, bounty:    0, type:'info' },
  { msg:'💨 Vents favorables ! Vous doublez la cadence.',             berries: 1000, bounty:    0, type:'success' },
  { msg:'🔱 Bouteille à la mer : coordonnées d\'un trésor secret.',   berries: 3000, bounty:    0, type:'success' },
  { msg:'🦈 Banc de requins ! Votre équipage les repousse.',          berries:    0, bounty: 3000, type:'info' },
  { msg:'🌋 Île volcanique en éruption — vous fuyez in extremis.',    berries:-1500, bounty:  200, type:'warn' },
  { msg:'👻 Vaisseau fantôme au large. Vous récupérez sa cargaison.', berries: 6000, bounty:    0, type:'success' },
];

function rndNav() { return NAV_EVENTS[Math.floor(Math.random() * NAV_EVENTS.length)]; }

// ══════════════════════════════════════════════════════════
//  EXPRESS + SOCKET.IO
// ══════════════════════════════════════════════════════════
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors:          { origin: '*' },
  pingInterval:  25_000,
  pingTimeout:   60_000,
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/history', async (req, res) => {
  try {
    const msgs = await Message.find().sort({ createdAt: -1 }).limit(50).lean();
    res.json(msgs.reverse());
  } catch { res.json([]); }
});
app.get('/api/leaderboard', async (req, res) => {
  try {
    const rows = await Player.find({ isBanned: false })
      .select('name faction bounty berries grade gradeIndex stats xp')
      .sort({ bounty: -1 }).limit(25).lean();
    res.json(rows);
  } catch { res.json([]); }
});
app.get('/api/combats', async (req, res) => {
  try {
    const logs = await CombatLog.find().sort({ createdAt: -1 }).limit(20).lean();
    res.json(logs);
  } catch { res.json([]); }
});
app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ══════════════════════════════════════════════════════════
//  ÉTAT EN MÉMOIRE
// ══════════════════════════════════════════════════════════
// socketId → { name, faction }
const onlineMap  = new Map();
// playerName → socketId (pour retrouver un socket)
const nameToSock = new Map();
// cooldown serveur : playerName → timestamp
const cdMap      = new Map();
// cache messages chat récents
const chatCache  = [];

function pushChat(msg) {
  chatCache.push(msg);
  if (chatCache.length > MAX_LOG_MSG) chatCache.shift();
}

function isOnCd(name) {
  const t = cdMap.get(name);
  return t && Date.now() - t < ACTION_CD;
}
function setCd(name) { cdMap.set(name, Date.now()); }

function findSocket(name) {
  const id = nameToSock.get(name);
  if (!id) return null;
  return io.sockets.sockets.get(id) || null;
}

async function broadcastLeaderboard() {
  try {
    const rows = await Player.find({ isBanned: false })
      .select('name faction bounty berries grade gradeIndex stats xp')
      .sort({ bounty: -1 }).limit(25).lean();
    io.emit('leaderboard:update', rows);
    io.emit('online:update', [...onlineMap.values()]);
  } catch {}
}

function sysMsg(text, channel = 'global') {
  const m = { author: 'SYSTÈME', faction: 'system', text, channel, isSystem: true, createdAt: new Date() };
  pushChat(m);
  io.emit('chat:message', m);
  // persistance optionnelle
  if (dbReady) Message.create(m).catch(() => {});
}

// ══════════════════════════════════════════════════════════
//  SOCKET HANDLERS
// ══════════════════════════════════════════════════════════
io.on('connection', (socket) => {
  console.log(`[WS+] ${socket.id}`);

  // Envoie l'état initial
  socket.emit('chat:history', chatCache.slice(-50));

  // ── REGISTER ─────────────────────────────────────────
  socket.on('auth:register', async ({ name, password, faction, adminCode }) => {
    if (!name?.trim() || !password) return socket.emit('auth:error', 'Nom et mot de passe requis');
    if (!dbReady) return socket.emit('auth:error', '⚠️ Base de données indisponible — réessayez dans quelques secondes');
    if (name.length > 28) return socket.emit('auth:error', 'Nom trop long (max 28 caractères)');

    try {
      const exists = await Player.findOne({ name: name.trim() });
      if (exists) return socket.emit('auth:error', 'Ce nom est déjà pris');

      const isAdmin   = faction === 'secret' && adminCode === ADMIN_CODE;
      const realFact  = isAdmin ? 'secret' : (faction || 'pirate');
      const hash      = await bcrypt.hash(password, 10);
      const token     = crypto.randomBytes(32).toString('hex');

      const player = new Player({
        name: name.trim(), passwordHash: hash,
        faction: realFact, adminLevel: isAdmin ? 2 : 0,
        sessionToken: token,
      });
      player.refreshGrade();
      await player.save();

      _connectPlayer(socket, player, token);
    } catch (e) {
      console.error('[REGISTER]', e.message);
      socket.emit('auth:error', e.code === 11000 ? 'Nom déjà pris' : e.message);
    }
  });

  // ── LOGIN ─────────────────────────────────────────────
  socket.on('auth:login', async ({ name, password }) => {
    if (!name?.trim() || !password) return socket.emit('auth:error', 'Champs manquants');
    if (!dbReady) return socket.emit('auth:error', '⚠️ Base de données indisponible');

    try {
      const player = await Player.findOne({ name: name.trim() });
      if (!player)                               return socket.emit('auth:error', 'Joueur inconnu');
      if (player.isBanned)                       return socket.emit('auth:error', '🚫 Compte banni');
      if (!(await player.checkPassword(password))) return socket.emit('auth:error', 'Mot de passe incorrect');

      const token = crypto.randomBytes(32).toString('hex');
      player.sessionToken = token;
      player.lastSeen     = new Date();
      await combat.checkRelease(player);
      await player.save();

      _connectPlayer(socket, player, token);
    } catch (e) { socket.emit('auth:error', e.message); }
  });

  // ── RECONNEXION PAR TOKEN ─────────────────────────────
  socket.on('auth:token', async ({ name, token }) => {
    if (!dbReady || !name || !token) return;
    try {
      const player = await Player.findOne({ name: name.trim(), sessionToken: token });
      if (!player || player.isBanned) return socket.emit('auth:error', 'Session expirée');
      player.lastSeen = new Date();
      await combat.checkRelease(player);
      await player.save();
      _connectPlayer(socket, player, token);
    } catch {}
  });

  // ── ACTION : ENTRAÎNER ────────────────────────────────
  socket.on('action:train', async () => {
    const name = socket.playerName;
    if (!name) return;
    if (isOnCd(name)) return socket.emit('action:cooldown', ACTION_CD);
    setCd(name);
    try {
      const p = await Player.findOne({ name });
      if (!p || p.isBanned) return;
      if (p.isJailed) return socket.emit('log:add', { type:'warn', msg:`⛓️ En prison ! Libération dans ${Math.ceil((p.jailUntil - Date.now())/1000)}s` });

      const xp      = Math.floor(Math.random() * 35) + 20;
      const bounty  = Math.floor(Math.random() * 300) + 100;
      p.xp     += xp;
      p.bounty += bounty;
      p.stats.trainCount++;
      p.refreshGrade();
      await p.save();

      socket.emit('log:add', { type:'success', msg:`💪 Entraînement terminé ! +${xp} XP · +${bounty.toLocaleString()} ฿ prime` });
      socket.emit('player:update', combat.sanitize(p));
      broadcastLeaderboard();
    } catch (e) { socket.emit('log:add', { type:'danger', msg:'Erreur serveur' }); }
  });

  // ── ACTION : PILLER ───────────────────────────────────
  socket.on('action:pillage', async () => {
    const name = socket.playerName;
    if (!name) return;
    if (isOnCd(name)) return socket.emit('action:cooldown', ACTION_CD);
    setCd(name);
    try {
      const p = await Player.findOne({ name });
      if (!p || p.isBanned) return;
      if (p.isJailed) return socket.emit('log:add', { type:'warn', msg:`⛓️ En prison !` });

      const berries = Math.floor(Math.random() * 9000) + 2000;
      const bounty  = Math.floor(Math.random() * 5000) + 1000;
      const wanted  = Math.random() < 0.35;

      p.berries += berries;
      p.bounty  += bounty;
      p.stats.pillageCount++;
      if (wanted) p.wantedLevel = Math.min(3, (p.wantedLevel || 0) + 1);
      p.refreshGrade();

      const arrested = await combat.checkArrest(p);
      await p.save();

      if (arrested) {
        socket.emit('log:add', { type:'danger', msg:`💰 Pillage réussi (+${berries.toLocaleString()} ฿)... mais la Marine vous intercepte !` });
        socket.emit('log:add', { type:'danger', msg:`⛓️ ARRÊTÉ ! Vous êtes en prison 30 secondes.` });
        sysMsg(`🚨 **${name}** vient d'être arrêté(e) par la Marine !`);
      } else {
        const warnStr = wanted ? ` ⚠️ Wanted ${p.wantedLevel}/3` : '';
        socket.emit('log:add', { type:'success', msg:`🏴‍☠️ Pillage réussi ! +${berries.toLocaleString()} ฿ · +${bounty.toLocaleString()} prime${warnStr}` });
      }

      socket.emit('player:update', combat.sanitize(p));
      broadcastLeaderboard();
    } catch (e) { socket.emit('log:add', { type:'danger', msg:'Erreur serveur' }); }
  });

  // ── ACTION : NAVIGUER ─────────────────────────────────
  socket.on('action:navigate', async () => {
    const name = socket.playerName;
    if (!name) return;
    if (isOnCd(name)) return socket.emit('action:cooldown', ACTION_CD);
    setCd(name);
    try {
      const p = await Player.findOne({ name });
      if (!p || p.isBanned) return;
      if (p.isJailed) return socket.emit('log:add', { type:'warn', msg:`⛓️ En prison !` });

      const ev = rndNav();
      p.berries = Math.max(0, p.berries + ev.berries);
      p.bounty  = Math.max(0, p.bounty  + ev.bounty);
      p.xp     += 15;
      p.stats.navCount++;
      p.refreshGrade();
      await p.save();

      socket.emit('log:add', { type: ev.type, msg: ev.msg });
      const sign = n => n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString();
      if (ev.berries !== 0) socket.emit('log:add', { type: ev.berries < 0 ? 'warn':'success', msg:`💰 ${sign(ev.berries)} Berrys` });
      if (ev.bounty  !== 0) socket.emit('log:add', { type:'info', msg:`🔱 ${sign(ev.bounty)} prime` });

      // Broadcast événement notable
      if (Math.abs(ev.berries) >= 5000 || ev.bounty >= 1000) {
        sysMsg(`⛵ **${name}** navigue : ${ev.msg}`);
      }

      socket.emit('player:update', combat.sanitize(p));
      broadcastLeaderboard();
    } catch { socket.emit('log:add', { type:'danger', msg:'Erreur serveur' }); }
  });

  // ── ACTION : COMBAT ───────────────────────────────────
  socket.on('action:combat', async ({ target }) => {
    const name = socket.playerName;
    if (!name || !target?.trim()) return;
    if (name === target) return socket.emit('log:add', { type:'warn', msg:'Impossible de se combattre soi-même !' });
    if (isOnCd(name)) return socket.emit('action:cooldown', ACTION_CD);
    setCd(name);
    try {
      const result = await combat.resolve(name, target);

      // Broadcast narration
      result.narrative.forEach(line => sysMsg(line));

      // Mise à jour en temps réel des deux joueurs
      const winSock = findSocket(result.winner);
      const losSock = findSocket(result.loser);
      winSock?.emit('player:update', result.winnerData);
      losSock?.emit('player:update', result.loserData);
      winSock?.emit('log:add', { type:'success', msg:`🏆 Victoire ! +${result.gains.bounty.toLocaleString()} prime · +${result.gains.berries.toLocaleString()} ฿ · +${result.gains.xp} XP` });
      losSock?.emit('log:add', { type:'danger',  msg:`💔 Défaite contre ${result.winner}. Courage !` });

      broadcastLeaderboard();
    } catch (e) { socket.emit('log:add', { type:'danger', msg:`❌ ${e.message}` }); }
  });

  // ── ACTION : LIBÉRATION PRISON ────────────────────────
  socket.on('action:release', async () => {
    const name = socket.playerName;
    if (!name) return;
    try {
      const p = await Player.findOne({ name });
      if (!p?.isJailed) return socket.emit('log:add', { type:'info', msg:'Vous n\'êtes pas en prison.' });
      const freed = await combat.checkRelease(p);
      if (freed) {
        socket.emit('log:add', { type:'success', msg:'🔓 Libéré(e) ! Vous pouvez à nouveau agir.' });
        socket.emit('player:update', combat.sanitize(p));
      } else {
        const secs = Math.max(0, Math.ceil((p.jailUntil - Date.now()) / 1000));
        socket.emit('log:add', { type:'warn', msg:`⛓️ Encore ${secs}s de prison...` });
      }
    } catch {}
  });

  // ── CHAT ─────────────────────────────────────────────
  socket.on('chat:send', async ({ text, channel }) => {
    const name = socket.playerName;
    if (!name) return socket.emit('log:add', { type:'warn', msg:'Connectez-vous d\'abord' });
    if (!text?.trim() || text.length > 500) return;

    try {
      const p = await Player.findOne({ name });
      if (!p || p.isBanned) return;
      if (p.isMuted) return socket.emit('log:add', { type:'warn', msg:'🔇 Vous êtes muté(e).' });

      const ch  = channel || 'global';
      const msg = { author: name, faction: p.faction, text: text.trim(), channel: ch, isSystem: false, createdAt: new Date() };
      pushChat(msg);

      // Diffusion : global = tout le monde, sinon seulement la faction
      if (ch === 'global') {
        io.emit('chat:message', msg);
      } else {
        [...io.sockets.sockets.values()]
          .filter(s => s.playerFaction === ch || s.playerFaction === 'secret')
          .forEach(s => s.emit('chat:message', msg));
      }

      if (dbReady) Message.create(msg).catch(() => {});
    } catch {}
  });

  // ── ADMIN ─────────────────────────────────────────────
  socket.on('admin:action', async ({ action, target, value, code }) => {
    if (code !== ADMIN_CODE) return socket.emit('log:add', { type:'danger', msg:'❌ Code admin incorrect' });
    try {
      const p = target ? await Player.findOne({ name: target }) : null;

      if (action === 'setBounty') {
        if (!p) return socket.emit('log:add', { type:'warn', msg:'Joueur introuvable' });
        p.bounty = Math.max(0, Number(value));
        p.refreshGrade();
        await p.save();
        findSocket(target)?.emit('player:update', combat.sanitize(p));
        sysMsg(`⚠️ AVIS DE RECHERCHE : La prime de **${target}** est fixée à ${Number(value).toLocaleString()} ฿`);
        broadcastLeaderboard();
      }

      if (action === 'setBerries') {
        if (!p) return;
        p.berries = Math.max(0, Number(value));
        p.refreshGrade();
        await p.save();
        findSocket(target)?.emit('player:update', combat.sanitize(p));
        socket.emit('log:add', { type:'success', msg:`✅ Berrys de ${target} fixés à ${Number(value).toLocaleString()}` });
        broadcastLeaderboard();
      }

      if (action === 'release') {
        if (!p) return;
        p.isJailed = false; p.jailUntil = null;
        await p.save();
        findSocket(target)?.emit('log:add', { type:'success', msg:'🔓 Libéré(e) par l\'administration.' });
        findSocket(target)?.emit('player:update', combat.sanitize(p));
        sysMsg(`🔓 **${target}** a été libéré(e) par l\'administration.`);
      }

      if (action === 'mute') {
        if (!p) return;
        p.isMuted = !p.isMuted;
        await p.save();
        socket.emit('log:add', { type:'info', msg:`${p.isMuted ? '🔇 Muté' : '🔊 Démuté'} : ${target}` });
      }

      if (action === 'ban') {
        if (!p) return;
        p.isBanned = true;
        await p.save();
        const s = findSocket(target);
        s?.emit('log:add', { type:'danger', msg:'🚫 Vous avez été banni(e).' });
        s?.disconnect();
        sysMsg(`🚫 **${target}** a été banni(e).`);
        broadcastLeaderboard();
      }

      if (action === 'unban') {
        await Player.findOneAndUpdate({ name: target }, { isBanned: false });
        socket.emit('log:add', { type:'success', msg:`✅ ${target} débanni(e)` });
      }

      if (action === 'resetStats') {
        if (!p) return;
        p.bounty = 0; p.berries = 5000; p.xp = 0;
        p.wantedLevel = 0; p.isJailed = false; p.jailUntil = null;
        p.stats = { trainCount:0, pillageCount:0, navCount:0, combatWins:0, combatLosses:0, arrested:0 };
        p.refreshGrade();
        await p.save();
        findSocket(target)?.emit('player:update', combat.sanitize(p));
        socket.emit('log:add', { type:'success', msg:`✅ Stats de ${target} réinitialisées` });
        broadcastLeaderboard();
      }

      if (action === 'broadcast') {
        sysMsg(String(value));
      }

    } catch (e) { socket.emit('log:add', { type:'danger', msg: e.message }); }
  });

  // ── DISCONNECT ────────────────────────────────────────
  socket.on('disconnect', () => {
    const name = socket.playerName;
    if (name) {
      nameToSock.delete(name);
      onlineMap.delete(socket.id);
      sysMsg(`👋 **${name}** a quitté le Grand Line.`);
      broadcastLeaderboard();
    }
    console.log(`[WS-] ${socket.id}`);
  });
});

// ── Connexion effective d'un joueur ──────────────────────
function _connectPlayer(socket, player, token) {
  socket.playerName    = player.name;
  socket.playerFaction = player.faction;
  onlineMap.set(socket.id, { name: player.name, faction: player.faction, grade: player.grade });
  nameToSock.set(player.name, socket.id);

  socket.emit('auth:success', { token, player: combat.sanitize(player) });
  socket.emit('chat:history', chatCache.slice(-50));
  sysMsg(`🌊 **${player.name}** (${player.faction}) a rejoint le Grand Line !`);
  broadcastLeaderboard();
}

// ══════════════════════════════════════════════════════════
//  BOOT
// ══════════════════════════════════════════════════════════
(async () => {
  await connectDB();
  server.listen(PORT, () => console.log(`⚓ One Piece RP V3 — http://localhost:${PORT}`));
})();
