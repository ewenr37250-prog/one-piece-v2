const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname)));

// --- CONFIG ---
const ADMIN_PASSWORD = "OPRP";

const COOLDOWNS = {
    train: 20 * 1000,
    pillage: 45 * 1000
};

// --- ÉTAT ---
let players = {};
let currentEvent = { name: "Aucun", multiplier: 1, color: "#c9a84c" };
let currentQuest = { active: false, title: "", goal: 0, progress: 0, type: "", reward: 0 };

// --- PERMISSIONS / MODOS ---
const PERMISSIONS = {
    START_EVENT: "start_event",
    START_QUEST: "start_quest",
    EDIT_PLAYER: "edit_player",
    BAN_PLAYER: "ban_player",
    UNBAN_PLAYER: "unban_player"
};

let moderators = {
    // Exemple :
    // "Ewen": { permissions: [PERMISSIONS.START_EVENT, PERMISSIONS.START_QUEST] }
};

let bannedPlayers = new Set();

function hasPermission(name, perm) {
    return moderators[name] && moderators[name].permissions.includes(perm);
}

function addModerator(name, perms = []) {
    moderators[name] = { permissions: perms };
}

function removeModerator(name) {
    delete moderators[name];
}

function banPlayer(name) {
    bannedPlayers.add(name);
}

function unbanPlayer(name) {
    bannedPlayers.delete(name);
}

// --- OUTILS ---
function now() { return Date.now(); }

function canUse(player, key, cdMs) {
    if (!player.cooldowns) player.cooldowns = {};
    const last = player.cooldowns[key] || 0;
    if (now() - last < cdMs) return false;
    player.cooldowns[key] = now();
    return true;
}

function addXP(player, amount) {
    player.xp += amount;
    if (player.xp >= 100 && player.xp < 300) player.grade = "Matelot";
    else if (player.xp >= 300 && player.xp < 700) player.grade = "Second";
    else if (player.xp >= 700 && player.xp < 1500) player.grade = "Capitaine";
    else if (player.xp >= 1500) player.grade = "Légende émergente";
}

function sendSystemMessage(text) {
    io.emit('chat:message', { author: "SYSTÈME", text, channel: "global" });
}

// --- MINI SCÉNARIOS ---
function resolveTrainScenario(player) {
    const roll = Math.random();
    if (roll < 0.7) {
        addXP(player, 10);
        return "Tu t'entraînes dur. Tu sens tes muscles brûler, mais tu progresses.";
    } else if (roll < 0.9) {
        addXP(player, 15);
        return "Entraînement intense ! Tu dépasses tes limites aujourd'hui.";
    } else {
        addXP(player, 5);
        if (!player.cooldownPenalty) player.cooldownPenalty = {};
        player.cooldownPenalty.train = (player.cooldownPenalty.train || 0) + 10 * 1000;
        return "Tu te blesses légèrement pendant l'entraînement. Tu devras récupérer un peu.";
    }
}

function resolvePillageScenario(player) {
    const roll = Math.random();
    let baseGain = Math.floor(Math.random() * 200) + 50;
    baseGain = Math.floor(baseGain * currentEvent.multiplier);

    if (roll < 0.6) {
        player.berries += baseGain;
        player.bounty += Math.floor(baseGain / 2);
        addXP(player, 10);
        return `Pillage réussi ! Tu récupères ${baseGain}฿ et ta prime augmente.`;
    } else if (roll < 0.9) {
        const gain = Math.floor(baseGain * 0.5);
        player.berries += gain;
        player.bounty += Math.floor(gain / 2);
        addXP(player, 15);
        return `Combat difficile, mais tu t'en sors. Tu récupères ${gain}฿ et gagnes en réputation.`;
    } else {
        const loss = Math.min(player.berries, Math.floor(baseGain * 0.7));
        player.berries -= loss;
        player.bounty += Math.floor(baseGain / 3);
        addXP(player, 5);
        return `Emboscade ! Tu perds ${loss}฿ et ta prime grimpe.`;
    }
}

// --- ÉVÉNEMENTS GLOBAUX ---
function triggerRandomWorldEvent() {
    const events = [
        { name: "Calme plat", multiplier: 1, color: "#c9a84c", msg: "Les mers sont étrangement calmes..." },
        { name: "Tempête", multiplier: 0.8, color: "#1f2937", msg: "Une tempête secoue Grand Line. Les pillages sont plus risqués." },
        { name: "Raid pirate", multiplier: 1.5, color: "#7f1d1d", msg: "Une vague de raids pirates déferle. Les gains explosent, mais les primes aussi." },
        { name: "Inspection de la Marine", multiplier: 0.7, color: "#1d4ed8", msg: "La Marine patrouille partout. Les criminels doivent se faire discrets." },
        { name: "Soulèvement révolutionnaire", multiplier: 1.3, color: "#065f46", msg: "Les Révolutionnaires agitent les foules. Le monde est en ébullition." }
    ];
    const ev = events[Math.floor(Math.random() * events.length)];
    currentEvent = { name: ev.name, multiplier: ev.multiplier, color: ev.color };
    io.emit('event:update', currentEvent);
    sendSystemMessage(ev.msg);
}

// --- PASSIF XP ---
setInterval(() => {
    Object.values(players).forEach(p => {
        addXP(p, 1);
        io.to(p.id).emit('player:update', p);
    });
}, 5 * 60 * 1000);

// --- ÉVÉNEMENTS ALÉATOIRES ---
setInterval(() => {
    triggerRandomWorldEvent();
}, 20 * 60 * 1000);

// --- SOCKET.IO ---
io.on('connection', (socket) => {
    console.log(`⚓ Connexion : ${socket.id}`);

    socket.emit('event:update', currentEvent);
    socket.emit('quest:update', currentQuest);

    // --- AUTH REGISTER ---
    socket.on('auth:register', (data) => {
        if (!data.name || players[data.name]) {
            return socket.emit('auth:error', "Nom déjà pris ou invalide !");
        }
        if (bannedPlayers.has(data.name)) {
            return socket.emit('auth:error', "Tu es banni de Grand Line.");
        }

        if (data.faction === "pantheon") {
            if (data.password === ADMIN_PASSWORD) {
                socket.isAdmin = true;
                socket.adminName = data.name;
                socket.join('admin_room');
                socket.emit('admin:success', { players: Object.values(players), moderators });
                console.log(`🟣 Accès Panthéon (register) : ${data.name}`);
            } else {
                socket.emit('auth:error', "Code Panthéon incorrect.");
            }
            return;
        }

        players[data.name] = {
            id: socket.id,
            name: data.name,
            password: data.password,
            faction: data.faction,
            berries: 1000,
            xp: 0,
            grade: "Mousse",
            bounty: 0,
            cooldowns: {},
            cooldownPenalty: {}
        };

        console.log(`📝 Nouveau joueur : ${data.name} [${data.faction}]`);
        socket.emit('auth:success', { player: players[data.name] });
        updateLeaderboard();
    });

    // --- AUTH LOGIN ---
    socket.on('auth:login', (data) => {
        if (bannedPlayers.has(data.name)) {
            return socket.emit('auth:error', "Tu es banni de Grand Line.");
        }

        if (data.faction === "pantheon") {
            if (data.password === ADMIN_PASSWORD) {
                socket.isAdmin = true;
                socket.adminName = data.name;
                socket.join('admin_room');
                socket.emit('admin:success', { players: Object.values(players), moderators });
                console.log(`🟣 Accès Panthéon (login) : ${data.name}`);
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

    // --- ACTIONS ---
    socket.on('action:train', () => {
        const p = Object.values(players).find(pl => pl.id === socket.id);
        if (!p) return;

        const penalty = (p.cooldownPenalty && p.cooldownPenalty.train) || 0;
        const cd = COOLDOWNS.train + penalty;

        if (!canUse(p, 'train', cd)) {
            socket.emit('action:cooldown', { action: 'train', remaining: cd - (now() - p.cooldowns.train) });
            return;
        }

        const msg = resolveTrainScenario(p);
        socket.emit('player:update', p);
        updateLeaderboard();
        socket.emit('action:result', { action: 'train', text: msg });
    });

    socket.on('action:pillage', () => {
        const p = Object.values(players).find(pl => pl.id === socket.id);
        if (!p) return;

        const penalty = (p.cooldownPenalty && p.cooldownPenalty.pillage) || 0;
        const cd = COOLDOWNS.pillage + penalty;

        if (!canUse(p, 'pillage', cd)) {
            socket.emit('action:cooldown', { action: 'pillage', remaining: cd - (now() - p.cooldowns.pillage) });
            return;
        }

        const msg = resolvePillageScenario(p);
        socket.emit('player:update', p);
        updateLeaderboard();
        socket.emit('action:result', { action: 'pillage', text: msg });
    });

    // --- CHAT ---
    socket.on('chat:send', (data) => {
        const p = Object.values(players).find(pl => pl.id === socket.id);
        if (!p) return;
        const payload = { author: p.name, text: data.text, channel: data.channel || "global" };
        io.emit('chat:message', payload);
        addXP(p, 1);
        socket.emit('player:update', p);
    });

    // --- ADMIN SIMPLE (code bouton ADMIN) ---
    socket.on('admin:login', (pass) => {
        if (pass === ADMIN_PASSWORD) {
            socket.isAdmin = true;
            socket.adminName = "Console";
            socket.join('admin_room');
            socket.emit('admin:success', { players: Object.values(players), moderators });
            console.log("🟣 Accès admin via code.");
        } else {
            socket.emit('auth:error', "Code admin incorrect.");
        }
    });

    // --- ADMIN : EVENTS & QUÊTES ---
    socket.on('admin:start_rp_event', (data) => {
        if (!socket.isAdmin || !hasPermission(socket.adminName, PERMISSIONS.START_EVENT) && socket.adminName !== "Console") return;

        let s = { name: "Normal", mult: 1, color: "#c9a84c", msg: "Le monde est calme." };
        if (data.scenario === 'marineford') s = { name: "Guerre de Marineford", mult: 2, color: "#7f1d1d", msg: "🔥 MARINEFORD ! Les primes doublent !" };
        if (data.scenario === 'buster_call') s = { name: "Buster Call", mult: 0.5, color: "#1a1a1a", msg: "🐚 Buster Call ! Le pillage est risqué." };

        currentEvent = { name: s.name, multiplier: s.mult, color: s.color };
        io.emit('event:update', currentEvent);
        sendSystemMessage(s.msg);
    });

    socket.on('admin:start_quest', (data) => {
        if (!socket.isAdmin || !hasPermission(socket.adminName, PERMISSIONS.START_QUEST) && socket.adminName !== "Console") return;

        currentQuest = {
            active: true,
            title: data.title,
            goal: parseInt(data.goal),
            progress: 0,
            type: data.type,
            reward: parseInt(data.reward)
        };
        io.emit('quest:update', currentQuest);
        sendSystemMessage(`Nouvelle quête : ${currentQuest.title}`);
    });

    // --- ADMIN : MODOS & BANS & EDIT ---
    socket.on('admin:add_moderator', ({ name, perms }) => {
        if (!socket.isAdmin) return;
        addModerator(name, perms || []);
        socket.emit('admin:log', `Modérateur ajouté : ${name}`);
    });

    socket.on('admin:remove_moderator', ({ name }) => {
        if (!socket.isAdmin) return;
        removeModerator(name);
        socket.emit('admin:log', `Modérateur retiré : ${name}`);
    });

    socket.on('admin:ban', ({ name }) => {
        if (!socket.isAdmin || !hasPermission(socket.adminName, PERMISSIONS.BAN_PLAYER) && socket.adminName !== "Console") return;
        banPlayer(name);
        socket.emit('admin:log', `${name} a été banni.`);
    });

    socket.on('admin:unban', ({ name }) => {
        if (!socket.isAdmin || !hasPermission(socket.adminName, PERMISSIONS.UNBAN_PLAYER) && socket.adminName !== "Console") return;
        unbanPlayer(name);
        socket.emit('admin:log', `${name} a été débanni.`);
    });

    socket.on('admin:edit_player', ({ name, berries, xp, bounty }) => {
        if (!socket.isAdmin || !hasPermission(socket.adminName, PERMISSIONS.EDIT_PLAYER) && socket.adminName !== "Console") return;
        const p = players[name];
        if (!p) return socket.emit('admin:log', "Joueur introuvable.");

        if (!isNaN(berries)) p.berries = berries;
        if (!isNaN(xp)) p.xp = xp;
        if (!isNaN(bounty)) p.bounty = bounty;

        io.to(p.id).emit('player:update', p);
        updateLeaderboard();
        socket.emit('admin:log', `Modifications appliquées à ${name}.`);
    });

    socket.on('disconnect', () => {
        console.log(`👋 Déconnexion : ${socket.id}`);
    });
});

// --- QUÊTES ---
function updateQuest(val) {
    if (!currentQuest.active) return;
    currentQuest.progress += val;
    io.emit('quest:update', currentQuest);
    if (currentQuest.progress >= currentQuest.goal) {
        sendSystemMessage(`VICTOIRE ! ${currentQuest.reward}฿ pour tous !`);
        Object.values(players).forEach(p => {
            p.berries += currentQuest.reward;
            io.to(p.id).emit('player:update', p);
        });
        currentQuest.active = false;
        io.emit('quest:update', currentQuest);
    }
}

// --- LEADERBOARD ---
function updateLeaderboard() {
    const list = Object.values(players)
        .sort((a, b) => b.bounty - a.bounty)
        .slice(0, 10);
    io.emit('leaderboard:update', list);
}

// --- LANCEMENT ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`⚓ Serveur prêt sur le port ${PORT}`));
