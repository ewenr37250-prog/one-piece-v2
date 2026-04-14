'use strict';
require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const { Player } = require('./models');
const combat = require('./combat');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 10000;
const MONGO_URI = process.env.MONGODB_URI;
const ACTION_CD = 3000; // 3 secondes de cooldown

const onlineMap = new Map(); // socket.id -> { name, faction }
const cdMap = new Map(); // name -> lastActionTimestamp

app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

mongoose.connect(MONGO_URI)
    .then(() => console.log('⚓ Moteur V2 branché et opérationnel sur le port ' + PORT))
    .catch(e => console.error('[DB ERROR]', e));

// Helpers
const isOnCd = (name) => cdMap.has(name) && Date.now() - cdMap.get(name) < ACTION_CD;
const setCd = (name) => cdMap.set(name, Date.now());

async function broadcastLeaderboard() {
    const top = await Player.find({ adminLevel: 0 }).sort({ bounty: -1 }).limit(25);
    io.emit('leaderboard:update', top.map(p => combat.sanitize(p)));
}

io.on('connection', (socket) => {
    socket.on('auth:login', async (data) => {
        const p = await Player.findOne({ name: data.name });
        if (!p || !(await p.checkPassword(data.password))) return socket.emit('auth:error', 'Identifiants invalides');
        _connectPlayer(socket, p);
    });

    socket.on('auth:register', async (data) => {
        const exists = await Player.findOne({ name: data.name });
        if (exists) return socket.emit('auth:error', 'Ce nom est déjà gravé sur une stèle');
        const p = new Player({ name: data.name, passwordHash: data.password, faction: data.faction });
        await p.save();
        _connectPlayer(socket, p);
    });

    socket.on('action:train', async () => {
        if (!socket.playerName || isOnCd(socket.playerName)) return;
        setCd(socket.playerName);
        const p = await Player.findOne({ name: socket.playerName });
        if (!p || p.isJailed) return;
        p.xp += 25; p.bounty += 500;
        p.refreshGrade(); await p.save();
        socket.emit('player:update', combat.sanitize(p));
        broadcastLeaderboard();
    });

    socket.on('action:pillage', async () => {
        if (!socket.playerName || isOnCd(socket.playerName)) return;
        setCd(socket.playerName);
        const p = await Player.findOne({ name: socket.playerName });
        if (!p || p.isJailed) return;
        p.berries += 2000; p.bounty += 1000; p.wantedLevel = Math.min(3, p.wantedLevel + 1);
        const arrested = await combat.checkArrest(p);
        await p.save();
        if (arrested) io.emit('chat:message', { author: 'Système', text: `🚨 ${p.name} a été jeté au cachot !`, isSystem: true });
        socket.emit('player:update', combat.sanitize(p));
        broadcastLeaderboard();
    });

    socket.on('action:betray', async () => {
        if (!socket.playerName) return;
        const p = await Player.findOne({ name: socket.playerName });
        if (!p || p.isTraitor) return;
        p.isTraitor = true; p.bounty = Math.floor(p.bounty * 0.5);
        // Change de camp
        p.faction = p.faction === 'marine' ? 'pirate' : 'revolutionnaire';
        await p.save();
        socket.emit('player:update', combat.sanitize(p));
        io.emit('chat:message', { author: 'Système', text: `⚖️ ${p.name} a choisi la trahison !`, isSystem: true });
        broadcastLeaderboard();
    });

    socket.on('chat:send', (data) => {
        if (!socket.playerName) return;
        const msg = { author: socket.playerName, text: data.text, channel: data.channel };
        if (data.channel === 'global') {
            io.emit('chat:message', msg);
        } else {
            for (let [id, user] of onlineMap) {
                if (user.faction === data.channel) io.to(id).emit('chat:message', msg);
            }
        }
    });

    socket.on('disconnect', () => onlineMap.delete(socket.id));
});

function _connectPlayer(socket, player) {
    socket.playerName = player.name;
    onlineMap.set(socket.id, { name: player.name, faction: player.faction });
    socket.emit('auth:success', { player: combat.sanitize(player) });
    broadcastLeaderboard();
}

server.listen(PORT);
