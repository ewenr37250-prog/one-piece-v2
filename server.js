const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Player } = require('./models');
const { resolveCombat } = require('./combat');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let players = {};

io.on('connection', (socket) => {
    socket.on('auth:login', (data) => {
        // Logique de connexion simplifiée pour l'exemple
        if (!players[data.name]) players[data.name] = new Player(data.name, 'pirate');
        socket.emit('auth:success', { token: 'fake-jwt', player: players[data.name] });
    });

    socket.on('act', (type) => {
        const p = players[socket.playerName];
        if (!p) return;
        // Mise à jour des stats et émission
        p.xp += 10;
        socket.emit('player:update', p);
    });
});

server.listen(3000, () => console.log('⚓ Serveur V3 lancé sur port 3000'));
