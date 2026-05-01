const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// CONFIGURATION
const MODO_PASSWORD = "CHEVA"; 
let players = {};

io.on('connection', (socket) => {
    // Authentification & Création
    socket.on('auth:login', ({ name, faction, classe }) => {
        if (!players[name]) {
            players[name] = {
                name, 
                faction: faction || "Pirate", 
                classe: classe || "Sabreur", 
                level: 1, xp: 0, xpNext: 1000,
                hp: 1250, hpMax: 1250, berries: 5000, bounty: 0,
                skillTree: { talentPoints: 1, branches: { "Sabre": 1, "Haki": 0, "Fruit": 0 } }
            };
        }
        socket.playerName = name;
        socket.emit('auth:success', { player: players[name] });
        io.emit('chat:message', { author: "SYSTÈME", text: `${name} a rejoint l'aventure !` });
    });

    // Actions Gameplay
    socket.on('action:train', () => {
        let p = players[socket.playerName];
        if (!p) return;
        p.xp += 100;
        if(p.xp >= p.xpNext) {
            p.level++; p.xp = 0; p.xpNext = Math.floor(p.xpNext * 1.5);
            p.skillTree.talentPoints++;
        }
        socket.emit('player:update', p);
        socket.emit('action:result', { text: "Entraînement intense terminé ! +100 XP" });
    });

    // Modération
    socket.on('modo:login', (code) => {
        if (code === MODO_PASSWORD) {
            socket.isAdmin = true;
            socket.emit('modo:success');
        } else {
            socket.emit('modo:fail');
        }
    });

    socket.on('modo:give_berries', ({ target, amount }) => {
        if (!socket.isAdmin) return;
        if (players[target]) {
            players[target].berries += parseInt(amount);
            io.emit('modo:log', `${amount} Berries donnés à ${target}`);
            // Update le socket du joueur cible s'il est en ligne
            io.sockets.forEach(s => { if(s.playerName === target) s.emit('player:update', players[target]); });
        }
    });

    socket.on('chat:send', ({ text }) => {
        if (socket.playerName) io.emit('chat:message', { author: socket.playerName, text });
    });
});

server.listen(3000, () => { console.log('🚢 Serveur OP lancé sur http://localhost:3000'); });
