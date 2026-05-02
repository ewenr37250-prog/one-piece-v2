const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

// Base de données temporaire (en mémoire)
let players = {};

io.on('connection', (socket) => {
    // Connexion / Création de perso
    socket.on('auth:login', ({ name }) => {
        if (!players[name]) {
            players[name] = {
                name, level: 42, hp: 1250, hpMax: 1250, 
                xp: 3580, xpNext: 7200, berries: 87500, 
                bounty: 1250000000, talents: 12, reputation: 315
            };
        }
        socket.playerName = name;
        socket.isAdmin = false;
        socket.emit('auth:success', { player: players[name] });
        io.emit('chat:message', { author: "SYSTÈME", text: `${name} a rejoint l'équipage !` });
    });

    // Gameplay
    socket.on('action:train', () => {
        let p = players[socket.playerName];
        if (p) {
            p.xp += 250;
            if(p.xp >= p.xpNext) {
                p.level++; p.xp = 0; p.xpNext = Math.floor(p.xpNext * 1.2);
                p.talents += 1;
            }
            socket.emit('player:update', p);
        }
    });

    // Modération
    socket.on('modo:login', (code) => {
        if (code === "CHEVA") {
            socket.isAdmin = true;
            socket.emit('modo:success');
        }
    });

    socket.on('modo:give_berries', ({ target, amount }) => {
        if (socket.isAdmin && players[target]) {
            players[target].berries += parseInt(amount);
            io.sockets.forEach(s => { if(s.playerName === target) s.emit('player:update', players[target]); });
            socket.emit('modo:log', `Succès : ${amount} Berries à ${target}`);
        }
    });

    // Chat
    socket.on('chat:send', ({ text }) => {
        if (socket.playerName) io.emit('chat:message', { author: socket.playerName, text });
    });
});

server.listen(3000, () => console.log('🚀 Serveur 40 000% prêt sur http://localhost:3000'));
