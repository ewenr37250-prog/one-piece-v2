const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname + '/public')); // Assure-toi que tes fichiers sont dans un dossier 'public'

// ==========================================
// CONFIGURATION DU JEU
// ==========================================
const MODO_PASSWORD = "LE_CHEVREUIL_2024"; // Ton code secret pour devenir modo
let players = {}; // Base de données temporaire
let currentEvent = null;

// ==========================================
// LOGIQUE SOCKET.IO
// ==========================================
io.on('connection', (socket) => {
    console.log(`⚓ Nouveau pirate en vue : ${socket.id}`);

    // --- AUTHENTIFICATION ---
    socket.on('auth:login', ({ name, password }) => {
        // Logique simplifiée : on crée ou on récupère le joueur
        if (!players[name]) {
            players[name] = createNewPlayer(name);
        }
        socket.playerName = name;
        socket.join('world-chat');
        socket.emit('auth:success', { player: players[name] });
        io.emit('chat:message', { author: "SYSTÈME", text: `${name} vient de monter à bord !` });
    });

    // --- ACTIONS DE GAMEPLAY ---
    socket.on('action:train', () => {
        let p = players[socket.playerName];
        if (!p) return;
        
        p.xp += 50;
        p.hp = Math.max(0, p.hp - 10);
        checkLevelUp(p);
        
        socket.emit('player:update', p);
        socket.emit('action:result', { text: "Tu t'es entraîné dur ! +50 XP" });
    });

    socket.on('action:work', () => {
        let p = players[socket.playerName];
        if (!p) return;
        
        const gain = 150;
        p.berries += gain;
        socket.emit('player:update', p);
        socket.emit('action:result', { text: `Tu as travaillé au port. +${gain} ฿` });
    });

    // --- SYSTÈME DE MODÉRATION ---
    socket.on('modo:login', (code) => {
        if (code === MODO_PASSWORD) {
            socket.isAdmin = true;
            socket.emit('modo:success');
            console.log(`⭐ ${socket.playerName} est maintenant MODÉRATEUR.`);
        } else {
            socket.emit('modo:fail');
        }
    });

    socket.on('modo:give_berries', ({ target, amount }) => {
        if (!socket.isAdmin) return;
        if (players[target]) {
            players[target].berries += amount;
            updatePlayerByName(target);
            socket.emit('modo:log', `${amount} ฿ donnés à ${target}`);
        }
    });

    socket.on('modo:kick', ({ target }) => {
        if (!socket.isAdmin) return;
        const targetSocket = findSocketByPlayerName(target);
        if (targetSocket) {
            targetSocket.disconnect();
            io.emit('chat:message', { author: "MARINE", text: `${target} a été jeté par-dessus bord !` });
        }
    });

    // --- CHAT ---
    socket.on('chat:send', ({ text }) => {
        if (!socket.playerName) return;
        io.emit('chat:message', { author: socket.playerName, text });
    });

    socket.on('disconnect', () => {
        console.log(`🏃 Un pirate a quitté le navire : ${socket.id}`);
    });
});

// ==========================================
// FONCTIONS UTILITAIRES
// ==========================================
function createNewPlayer(name) {
    return {
        name: name,
        level: 1,
        xp: 0,
        xpNext: 1000,
        hp: 100,
        hpMax: 100,
        berries: 500,
        bounty: 0,
        reputation: 0,
        skillTree: {
            talentPoints: 1,
            maxLevel: 10,
            branches: { "Force": 1, "Agilité": 1, "Haki": 0 }
        }
    };
}

function checkLevelUp(p) {
    if (p.xp >= p.xpNext) {
        p.level++;
        p.xp = 0;
        p.xpNext = Math.floor(p.xpNext * 1.5);
        p.skillTree.talentPoints += 1;
    }
}

function updatePlayerByName(name) {
    const s = findSocketByPlayerName(name);
    if (s) s.emit('player:update', players[name]);
}

function findSocketByPlayerName(name) {
    for (let [id, socket] of io.of("/").sockets) {
        if (socket.playerName === name) return socket;
    }
    return null;
}

server.listen(3000, () => {
    console.log('🚢 Serveur lancé sur http://localhost:3000');
});
