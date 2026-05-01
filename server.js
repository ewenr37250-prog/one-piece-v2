const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- CORRECTION DU "CANNOT GET /" ---
// On dit à Express d'utiliser le dossier courant (.) pour les fichiers statiques
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// --- VARIABLES DU JEU ---
const MODO_PASSWORD = "CHEVA"; // Ton code secret
let players = {};

// --- LOGIQUE SOCKET ---
io.on('connection', (socket) => {
    console.log(`⚓ Nouveau pirate : ${socket.id}`);

    socket.on('auth:login', ({ name, password }) => {
        if (!players[name]) players[name] = createNewPlayer(name);
        socket.playerName = name;
        socket.emit('auth:success', { player: players[name] });
        io.emit('chat:message', { author: "SYSTÈME", text: `${name} a rejoint l'aventure !` });
    });

    socket.on('action:train', () => {
        let p = players[socket.playerName];
        if (!p) return;
        p.xp += 50;
        p.hp = Math.max(0, p.hp - 5);
        if (p.xp >= p.xpNext) {
            p.level++; p.xp = 0; p.xpNext *= 1.5; p.skillTree.talentPoints++;
        }
        socket.emit('player:update', p);
        socket.emit('action:result', { text: "Entraînement réussi ! +50 XP" });
    });

    socket.on('action:work', () => {
        let p = players[socket.playerName];
        if (!p) return;
        p.berries += 100;
        socket.emit('player:update', p);
        socket.emit('action:result', { text: "Travail terminé. +100 Berries ฿" });
    });

    socket.on('modo:login', (code) => {
        if (code === MODO_PASSWORD) {
            socket.isAdmin = true;
            socket.emit('modo:success');
        } else {
            socket.emit('modo:fail');
        }
    });

    socket.on('chat:send', ({ text }) => {
        if (socket.playerName) io.emit('chat:message', { author: socket.playerName, text });
    });
});

function createNewPlayer(name) {
    return {
        name, level: 1, xp: 0, xpNext: 500, hp: 100, hpMax: 100, berries: 500, bounty: 0,
        skillTree: { talentPoints: 0, maxLevel: 10, branches: { "Force": 1, "Agilité": 1, "Haki": 0 } }
    };
}

server.listen(3000, () => { console.log('🚢 Navire prêt sur http://localhost:3000'); });
