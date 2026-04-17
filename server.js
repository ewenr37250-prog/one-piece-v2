const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname)));

// --- DONNÉES DU MONDE ---
let players = {};
let currentEvent = { name: "Aucun", multiplier: 1, color: "#c9a84c" };
let currentQuest = { active: false, title: "", goal: 0, progress: 0, type: "", reward: 0 };
const ADMIN_PASSWORD = "OPRP"; // Mot de passe admin par défaut

io.on('connection', (socket) => {
    console.log(`⚓ Nouveau marin : ${socket.id}`);

    // Synchro initiale
    socket.emit('event:update', currentEvent);
    socket.emit('quest:update', currentQuest);

    // --- AUTHENTIFICATION ---
    socket.on('auth:register', (data) => {
        // Panthéon = vue modo RP, pas un joueur
        if (data.faction === "pantheon") {
            if (data.password === ADMIN_PASSWORD) {
                socket.join('admin_room');
                socket.emit('admin:success', { players: Object.values(players) });
                console.log(`🟣 Accès Panthéon pour ${data.name}`);
            } else {
                socket.emit('auth:error', "Code Panthéon incorrect.");
            }
            return;
        }

        if (!data.name || players[data.name]) {
            return socket.emit('auth:error', "Nom déjà pris ou invalide !");
        }

        players[data.name] = {
            id: socket.id,
            name: data.name,
            password: data.password,
            faction: data.faction,
            berries: 1000,
            xp: 0,
            grade: "Mousse",
            bounty: 0
        };

        console.log(`📝 Nouveau joueur : ${data.name} [${data.faction}]`);
        socket.emit('auth:success', { player: players[data.name] });
        updateLeaderboard();
    });

    socket.on('auth:login', (data) => {
        // Connexion Panthéon
        if (data.faction === "pantheon") {
            if (data.password === ADMIN_PASSWORD) {
                socket.join('admin_room');
                socket.emit('admin:success', { players: Object.values(players) });
                console.log(`🟣 Connexion Panthéon : ${data.name}`);
            } else {
                socket.emit('auth:error', "Code Panthéon incorrect.");
            }
            return;
        }

        const p = players[data.name];
        if (p && p.password === data.password) {
            p.id = socket.id;
            socket.emit('auth:success', { player: p });
            console.log(`🔑 Connexion joueur : ${data.name}`);
        } else {
            socket.emit('auth:error', "Identifiants invalides.");
        }
    });

    // --- ACTIONS JEU ---
    socket.on('action:train', () => {
        const p = Object.values(players).find(pl => pl.id === socket.id);
        if (!p) return;
        p.xp += 10;
        if (p.xp >= 100) p.grade = "Matelot";
        if (currentQuest.active && currentQuest.type === 'train') updateQuest(1);
        socket.emit('player:update', p);
    });

    socket.on('action:pillage', () => {
        const p = Object.values(players).find(pl => pl.id === socket.id);
        if (!p) return;
        let gain = (Math.floor(Math.random() * 200) + 50) * currentEvent.multiplier;
        p.berries += Math.floor(gain);
        p.bounty += Math.floor(gain / 2);
        if (currentQuest.active && currentQuest.type === 'pillage') updateQuest(1);
        socket.emit('player:update', p);
        updateLeaderboard();
    });

    // --- CHAT ---
    socket.on('chat:send', (data) => {
        const p = Object.values(players).find(pl => pl.id === socket.id);
        if (!p) return;
        const payload = { author: p.name, text: data.text, channel: data.channel };
        io.emit('chat:message', payload);
    });

    // --- ADMIN ---
    socket.on('admin:login', (pass) => {
        if (pass === ADMIN_PASSWORD) {
            socket.join('admin_room');
            socket.emit('admin:success', { players: Object.values(players) });
            console.log("🟣 Accès admin via code.");
        } else {
            socket.emit('auth:error', "Code admin incorrect.");
        }
    });

    socket.on('admin:start_rp_event', (data) => {
        let s = { name: "Normal", mult: 1, color: "#c9a84c", msg: "Le monde est calme." };
        if (data.scenario === 'marineford') s = { name: "Guerre de Marineford", mult: 2, color: "#7f1d1d", msg: "🔥 MARINEFORD ! Les primes doublent !" };
        if (data.scenario === 'buster_call') s = { name: "Buster Call", mult: 0.5, color: "#1a1a1a", msg: "🐚 Buster Call ! Le pillage est risqué." };

        currentEvent = { name: s.name, multiplier: s.mult, color: s.color };
        io.emit('event:update', currentEvent);
        io.emit('chat:message', { author: "SYSTÈME", text: s.msg, channel: "global" });
    });

    socket.on('admin:start_quest', (data) => {
        currentQuest = {
            active: true,
            title: data.title,
            goal: parseInt(data.goal),
            progress: 0,
            type: data.type,
            reward: parseInt(data.reward)
        };
        io.emit('quest:update', currentQuest);
        io.emit('chat:message', { author: "QUÊTE", text: `Nouvelle quête : ${currentQuest.title}`, channel: "global" });
    });

    socket.on('disconnect', () => {
        console.log("👋 Départ d'un marin");
    });
});

function updateQuest(val) {
    if (!currentQuest.active) return;
    currentQuest.progress += val;
    io.emit('quest:update', currentQuest);
    if (currentQuest.progress >= currentQuest.goal) {
        io.emit('chat:message', { author: "QUÊTE", text: `VICTOIRE ! ${currentQuest.reward}฿ pour tous !`, channel: "global" });
        Object.values(players).forEach(p => {
            p.berries += currentQuest.reward;
            io.to(p.id).emit('player:update', p);
        });
        currentQuest.active = false;
        io.emit('quest:update', currentQuest);
    }
}

function updateLeaderboard() {
    const list = Object.values(players)
        .sort((a, b) => b.bounty - a.bounty)
        .slice(0, 10);
    io.emit('leaderboard:update', list);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`⚓ Serveur prêt sur le port ${PORT}`));
