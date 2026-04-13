'use strict';
require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Server } = require('socket.io');

// Import de tes modèles et de la logique de combat
const { Player, CombatLog, Message } = require('./models');
const combat = require('./combat');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: '*' } 
});

const PORT = process.env.PORT || 10000;
const MONGO_URI = process.env.MONGODB_URI;
const ADMIN_CODE = process.env.ADMIN_CODE || 'OP2026';
const ACTION_CD = 3000;

const onlineMap = new Map();
const cdMap = new Map();
const chatCache = [];

// --- CONNEXION DATABASE ---
let dbReady = false;
async function connectDB() {
    if (!MONGO_URI) {
        console.error('[DB] ❌ MONGODB_URI manquante !');
        return;
    }
    try {
        await mongoose.connect(MONGO_URI);
        dbReady = true;
        console.log('[DB] ✅ MongoDB connecté');
    } catch (e) {
        console.error('[DB] ❌ Erreur :', e.message);
        setTimeout(connectDB, 5000);
    }
}
connectDB();

// --- GESTION DES FICHIERS (LA CORRECTION EST ICI) ---

// 1. On autorise l'accès aux fichiers (css, js, images) qui sont à la racine
app.use(express.static(__dirname)); 

// 2. ROUTE PRINCIPALE : On force l'envoi de l'index.html quoi qu'il arrive
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'), (err) => {
        if (err) {
            // Si le fichier est absent, on affiche une erreur claire au lieu du JSON
            res.status(404).send("<h1>Erreur : Fichier index.html introuvable sur GitHub !</h1>");
        }
    });
});

// --- SYSTÈME DE MESSAGES ---
const sysMsg = (text) => {
    const m = { author: 'SYSTÈME', faction: 'system', text, channel: 'global', isSystem: true, createdAt: new Date() };
    chatCache.push(m);
    if (chatCache.length > 100) chatCache.shift();
    io.emit('chat:message', m);
};

function isOnCd(name) {
    const t = cdMap.get(name);
    return t && Date.now() - t < ACTION_CD;
}
function setCd(name) { cdMap.set(name, Date.now()); }

async function broadcastLeaderboard() {
    try {
        const rows = await Player.find({ isBanned: false })
            .select('name faction bounty berries grade gradeIndex isTraitor')
            .sort({ bounty: -1 }).limit(25).lean();
        io.emit('leaderboard:update', rows);
        io.emit('online:update', [...onlineMap.values()]);
    } catch (e) {}
}

// --- SOCKETS ---
io.on('connection', (socket) => {
    socket.emit('chat:history', chatCache.slice(-50));

    socket.on('auth:register', async ({ name, password, faction, adminCode }) => {
        if (!dbReady) return;
        try {
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
        } catch (e) { socket.emit('auth:error', 'Nom déjà pris ou erreur.'); }
    });

    socket.on('auth:login', async ({ name, password }) => {
        if (!dbReady) return;
        const p = await Player.findOne({ name: name.trim() });
        if (p && await p.checkPassword(password)) {
            p.sessionToken = crypto.randomBytes(32).toString('hex');
            await p.save();
            _connectPlayer(socket, p, p.sessionToken);
        } else { socket.emit('auth:error', 'Identifiants incorrects.'); }
    });

    socket.on('action:betray', async () => {
        const p = await Player.findOne({ name: socket.playerName });
        if (!p || p.isJailed || p.isTraitor) return;
        p.bounty *= 0.5; p.berries *= 0.5; p.isTraitor = true;
        p.traitorUntil = new Date(Date.now() + 86400000);
        p.faction = (p.faction === 'marine') ? 'revolutionnaire' : 'pirate';
        p.refreshGrade(); await p.save();
        _connectPlayer(socket, p, p.sessionToken);
        sysMsg(`⚖️ TRAHISON : ${p.name} a rejoint les ${p.faction}s !`);
    });

    socket.on('chat:send', async ({ text, channel }) => {
        const p = await Player.findOne({ name: socket.playerName });
        if (!p || p.isMuted) return;
        const msg = { author: p.name, faction: p.faction, text, channel: channel || 'global', createdAt: new Date() };
        io.emit('chat:message', msg);
    });

    socket.on('action:train', async () => {
        if (isOnCd(socket.playerName)) return;
        setCd(socket.playerName);
        const p = await Player.findOne({ name: socket.playerName });
        if (!p || p.isJailed) return;
        p.xp += 25; p.bounty += 500; p.stats.trainCount++;
        p.refreshGrade(); await p.save();
        socket.emit('player:update', combat.sanitize(p));
        broadcastLeaderboard();
    });

    socket.on('action:pillage', async () => {
        if (isOnCd(socket.playerName)) return;
        setCd(socket.playerName);
        const p = await Player.findOne({ name: socket.playerName });
        if (!p || p.isJailed) return;
        p.berries += 2000; p.bounty += 1000; p.wantedLevel = Math.min(3, p.wantedLevel + 1);
        const arrested = await combat.checkArrest(p);
        await p.save();
        if (arrested) sysMsg(`🚨 ${p.name} a été arrêté par la Marine !`);
        socket.emit('player:update', combat.sanitize(p));
        broadcastLeaderboard();
    });

    socket.on('disconnect', () => {
        onlineMap.delete(socket.id);
        broadcastLeaderboard();
    });
});

async function _connectPlayer(socket, player, token) {
    socket.playerName = player.name;
    socket.playerFaction = player.faction;
    onlineMap.set(socket.id, { name: player.name, faction: player.faction });
    socket.emit('auth:success', { token, player: combat.sanitize(player) });
    broadcastLeaderboard();
}

server.listen(PORT, () => {
    console.log(`⚓ SERVEUR ONE PIECE LIVE SUR PORT ${PORT}`);
});
