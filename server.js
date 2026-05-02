const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let players = {};

io.on('connection', (socket) => {
    // Authentification & Création
    socket.on('auth:login', ({ name }) => {
        if (!players[name]) {
            players[name] = {
                name: name, 
                level: 1, 
                hp: 100, hpMax: 100, 
                xp: 0, xpNext: 100, 
                berries: 0, 
                bounty: 0
            };
        }
        socket.playerName = name;
        socket.emit('auth:success', { player: players[name] });
        io.emit('chat:message', { author: "SYSTÈME", text: `${name} a rejoint l'aventure !` });
    });

    // Entraînement
    socket.on('action:train', () => {
        let p = players[socket.playerName];
        if (p) {
            p.xp += 15;
            if (p.xp >= p.xpNext) {
                p.level++; 
                p.xp = 0; 
                p.xpNext = Math.floor(p.xpNext * 1.5);
                p.hpMax += 20;
                p.hp = p.hpMax;
            }
            socket.emit('player:update', p);
        }
    });

    // Chat
    socket.on('chat:send', ({ text }) => {
        if (socket.playerName) {
            io.emit('chat:message', { author: socket.playerName, text });
        }
    });
});

server.listen(3000, () => {
    console.log('🏴‍☠️ Serveur RPG en ligne sur http://localhost:3000');
});
