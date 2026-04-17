const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;

// --- CONFIG ---
const MODO_CODE = "PANTHEON_OP"; // code spécial modo

const COOLDOWNS = {
    train: 20 * 1000,
    quest: 30 * 1000
};

// --- ÉTAT ---
let players = {};          // par nom
let socketsToPlayer = {};  // socket.id -> playerName

let currentFactionQuests = {}; // par faction
let currentClassQuests = {};   // par classe

// --- CLASSES & ARBRES DE COMPÉTENCES ---

const CLASSES = [
    "Guerrier",
    "Tireur",
    "Navigateur",
    "Médecin",
    "Charpentier",
    "Espion",
    "Artiste Martial"
];

// 4 branches x 5 niveaux max
const SKILL_TREE_TEMPLATE = {
    "Guerrier": {
        branches: {
            "Force brute": 0,
            "Défense": 0,
            "Technique d'armes": 0,
            "Haki de l'Armement": 0
        },
        maxLevel: 5
    },
    "Tireur": {
        branches: {
            "Précision": 0,
            "Vitesse": 0,
            "Armes spéciales": 0,
            "Haki de l'Observation": 0
        },
        maxLevel: 5
    },
    "Navigateur": {
        branches: {
            "Météo": 0,
            "Orientation": 0,
            "Cartographie": 0,
            "Climat-Tact": 0
        },
        maxLevel: 5
    },
    "Médecin": {
        branches: {
            "Soins": 0,
            "Pharmacie": 0,
            "Biologie": 0,
            "Rumble Ball": 0
        },
        maxLevel: 5
    },
    "Charpentier": {
        branches: {
            "Construction": 0,
            "Réparation": 0,
            "Ingénierie": 0,
            "Cyborg": 0
        },
        maxLevel: 5
    },
    "Espion": {
        branches: {
            "Infiltration": 0,
            "Sabotage": 0,
            "Manipulation": 0,
            "Assassinat": 0
        },
        maxLevel: 5
    },
    "Artiste Martial": {
        branches: {
            "Techniques": 0,
            "Agilité": 0,
            "Ki / Énergie": 0,
            "Haki du Roi": 0
        },
        maxLevel: 5
    }
};

// --- QUÊTES DE FACTION ---

const FACTION_QUEST_POOL = {
    "pirate": [
        { id: "P1", title: "Piller un village", goal: 5, rewardBerries: 500, rewardXP: 50 },
        { id: "P2", title: "Attaquer un navire marchand", goal: 3, rewardBerries: 800, rewardXP: 80 },
        { id: "P3", title: "Trouver un trésor", goal: 2, rewardBerries: 1200, rewardXP: 100 }
    ],
    "marine": [
        { id: "M1", title: "Patrouiller les mers", goal: 5, rewardBerries: 400, rewardXP: 40 },
        { id: "M2", title: "Arrêter un pirate", goal: 3, rewardBerries: 700, rewardXP: 70 },
        { id: "M3", title: "Inspecter un navire", goal: 4, rewardBerries: 600, rewardXP: 60 }
    ],
    "revolutionnaire": [
        { id: "R1", title: "Saboter un poste de la Marine", goal: 3, rewardBerries: 700, rewardXP: 70 },
        { id: "R2", title: "Libérer un village", goal: 2, rewardBerries: 900, rewardXP: 90 },
        { id: "R3", title: "Propager un message révolutionnaire", goal: 5, rewardBerries: 500, rewardXP: 50 }
    ]
};

// --- QUÊTES DE CLASSE ---

const CLASS_QUEST_POOL = {
    "Guerrier": [
        { id: "G1", title: "Duel d'entraînement", goal: 3, rewardXP: 40, rewardTalent: 1 },
        { id: "G2", title: "Maîtrise d'arme", goal: 5, rewardXP: 70, rewardTalent: 2 }
    ],
    "Tireur": [
        { id: "T1", title: "Séance de tir", goal: 5, rewardXP: 40, rewardTalent: 1 },
        { id: "T2", title: "Tir de précision", goal: 3, rewardXP: 70, rewardTalent: 2 }
    ],
    "Navigateur": [
        { id: "N1", title: "Tracer une route sûre", goal: 3, rewardXP: 40, rewardTalent: 1 },
        { id: "N2", title: "Éviter une tempête", goal: 2, rewardXP: 70, rewardTalent: 2 }
    ],
    "Médecin": [
        { id: "ME1", title: "Soigner un équipage", goal: 3, rewardXP: 40, rewardTalent: 1 },
        { id: "ME2", title: "Préparer un remède", goal: 2, rewardXP: 70, rewardTalent: 2 }
    ],
    "Charpentier": [
        { id: "C1", title: "Réparer un navire", goal: 3, rewardXP: 40, rewardTalent: 1 },
        { id: "C2", title: "Renforcer la coque", goal: 2, rewardXP: 70, rewardTalent: 2 }
    ],
    "Espion": [
        { id: "E1", title: "Infiltrer une base", goal: 2, rewardXP: 50, rewardTalent: 1 },
        { id: "E2", title: "Voler des informations", goal: 3, rewardXP: 80, rewardTalent: 2 }
    ],
    "Artiste Martial": [
        { id: "AM1", title: "Entraînement intensif", goal: 3, rewardXP: 40, rewardTalent: 1 },
        { id: "AM2", title: "Maîtriser une nouvelle technique", goal: 2, rewardXP: 70, rewardTalent: 2 }
    ]
};

// --- OUTILS ---

function cloneSkillTreeForClass(classe) {
    const tpl = SKILL_TREE_TEMPLATE[classe];
    return {
        branches: { ...tpl.branches },
        maxLevel: tpl.maxLevel,
        talentPoints: 0
    };
}

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
    while (player.xp >= xpForLevel(player.level + 1)) {
        player.level++;
        player.skillTree.talentPoints++;
    }
}

function xpForLevel(level) {
    return 100 * level; // simple
}

function sendPlayerUpdate(player) {
    io.to(player.id).emit('player:update', sanitizePlayer(player));
}

function sanitizePlayer(p) {
    return {
        name: p.name,
        faction: p.faction,
        classe: p.classe,
        berries: p.berries,
        xp: p.xp,
        level: p.level,
        bounty: p.bounty,
        skillTree: p.skillTree,
        factionQuest: p.factionQuest,
        classQuest: p.classQuest
    };
}

function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// --- SOCKET.IO ---

io.on('connection', (socket) => {
    console.log("⚓ Nouveau joueur :", socket.id);

    socket.on('auth:register', (data) => {
        const { name, password, faction, classe } = data;
        if (!name || !password || !faction || !classe) {
            return socket.emit('auth:error', "Champs manquants.");
        }
        if (players[name]) {
            return socket.emit('auth:error', "Nom déjà pris.");
        }
        if (!["pirate", "marine", "revolutionnaire"].includes(faction)) {
            return socket.emit('auth:error', "Faction invalide.");
        }
        if (!CLASSES.includes(classe)) {
            return socket.emit('auth:error', "Classe invalide.");
        }

        const player = {
            id: socket.id,
            name,
            password,
            faction,
            classe,
            berries: 1000,
            xp: 0,
            level: 1,
            bounty: 0,
            cooldowns: {},
            skillTree: cloneSkillTreeForClass(classe),
            factionQuest: null,
            classQuest: null,
            isModo: false
        };

        players[name] = player;
        socketsToPlayer[socket.id] = name;

        socket.emit('auth:success', { player: sanitizePlayer(player) });
        console.log(`📝 Nouveau joueur : ${name} [${faction} / ${classe}]`);
    });

    socket.on('auth:login', (data) => {
        const { name, password } = data;
        const p = players[name];
        if (!p || p.password !== password) {
            return socket.emit('auth:error', "Identifiants invalides.");
        }
        p.id = socket.id;
        socketsToPlayer[socket.id] = name;
        socket.emit('auth:success', { player: sanitizePlayer(p) });
        console.log(`🔑 Connexion : ${name}`);
    });

    // --- ACTIONS RP SIMPLES ---

    socket.on('action:train', () => {
        const p = getPlayerBySocket(socket);
        if (!p) return;
        if (!canUse(p, 'train', COOLDOWNS.train)) {
            const remaining = COOLDOWNS.train - (now() - p.cooldowns.train);
            return socket.emit('action:cooldown', { action: 'train', remaining });
        }
        const xpGain = 10 + p.level;
        addXP(p, xpGain);
        socket.emit('action:result', { text: `Tu t'entraînes dur et gagnes ${xpGain} XP.` });
        sendPlayerUpdate(p);
    });

    socket.on('action:quest_progress', (data) => {
        const p = getPlayerBySocket(socket);
        if (!p) return;
        if (!canUse(p, 'quest', COOLDOWNS.quest)) {
            const remaining = COOLDOWNS.quest - (now() - p.cooldowns.quest);
            return socket.emit('action:cooldown', { action: 'quest', remaining });
        }

        const { type } = data; // "faction" ou "class"
        if (type === "faction" && p.factionQuest) {
            p.factionQuest.progress++;
            checkFactionQuestCompletion(p);
        } else if (type === "class" && p.classQuest) {
            p.classQuest.progress++;
            checkClassQuestCompletion(p);
        }
        sendPlayerUpdate(p);
    });

    // --- QUÊTES ---

    socket.on('quest:request_faction', () => {
        const p = getPlayerBySocket(socket);
        if (!p) return;
        if (p.factionQuest) {
            return socket.emit('quest:faction_update', p.factionQuest);
        }
        const pool = FACTION_QUEST_POOL[p.faction];
        if (!pool) return;
        const q = pickRandom(pool);
        p.factionQuest = { ...q, progress: 0 };
        socket.emit('quest:faction_update', p.factionQuest);
        sendPlayerUpdate(p);
    });

    socket.on('quest:request_class', () => {
        const p = getPlayerBySocket(socket);
        if (!p) return;
        if (p.classQuest) {
            return socket.emit('quest:class_update', p.classQuest);
        }
        const pool = CLASS_QUEST_POOL[p.classe];
        if (!pool) return;
        const q = pickRandom(pool);
        p.classQuest = { ...q, progress: 0 };
        socket.emit('quest:class_update', p.classQuest);
        sendPlayerUpdate(p);
    });

    // --- ARBRE DE COMPÉTENCES ---

    socket.on('skill:upgrade', ({ branch }) => {
        const p = getPlayerBySocket(socket);
        if (!p) return;
        const tree = p.skillTree;
        if (!tree.branches[branch]) tree.branches[branch] = 0;

        if (tree.talentPoints <= 0) {
            return socket.emit('skill:error', "Pas assez de points de talent.");
        }
        if (tree.branches[branch] >= tree.maxLevel) {
            return socket.emit('skill:error', "Cette branche est déjà au niveau maximum.");
        }

        tree.branches[branch]++;
        tree.talentPoints--;
        socket.emit('skill:update', tree);
        sendPlayerUpdate(p);
    });

    // --- CHAT ---

    socket.on('chat:send', ({ text }) => {
        const p = getPlayerBySocket(socket);
        if (!p || !text) return;
        io.emit('chat:message', { author: p.name, text, channel: "global" });
    });

    // --- MODO ---

    socket.on('modo:login', (code) => {
        const p = getPlayerBySocket(socket);
        if (!p) return;
        if (code === MODO_CODE) {
            p.isModo = true;
            socket.emit('modo:success');
            console.log(`🟣 Modo activé : ${p.name}`);
        } else {
            socket.emit('modo:fail');
        }
    });

    socket.on('modo:give_berries', ({ target, amount }) => {
        const p = getPlayerBySocket(socket);
        if (!p || !p.isModo) return;
        const t = players[target];
        if (!t) return;
        t.berries += amount;
        sendPlayerUpdate(t);
        socket.emit('modo:log', `+${amount} ฿ pour ${target}`);
    });

    socket.on('modo:kick', ({ target }) => {
        const p = getPlayerBySocket(socket);
        if (!p || !p.isModo) return;
        const t = players[target];
        if (!t) return;
        const sId = t.id;
        if (sId && io.sockets.sockets.get(sId)) {
            io.sockets.sockets.get(sId).disconnect(true);
        }
        socket.emit('modo:log', `Kick de ${target}`);
    });

    socket.on('disconnect', () => {
        const name = socketsToPlayer[socket.id];
        delete socketsToPlayer[socket.id];
        console.log("👋 Déconnexion :", socket.id, name || "");
    });
});

// --- FONCTIONS QUÊTES ---

function getPlayerBySocket(socket) {
    const name = socketsToPlayer[socket.id];
    if (!name) return null;
    return players[name];
}

function checkFactionQuestCompletion(p) {
    const q = p.factionQuest;
    if (!q) return;
    if (q.progress >= q.goal) {
        p.berries += q.rewardBerries;
        addXP(p, q.rewardXP);
        p.factionQuest = null;
    }
}

function checkClassQuestCompletion(p) {
    const q = p.classQuest;
    if (!q) return;
    if (q.progress >= q.goal) {
        addXP(p, q.rewardXP);
        p.skillTree.talentPoints += q.rewardTalent;
        p.classQuest = null;
    }
}

// --- LANCEMENT ---

server.listen(PORT, () => {
    console.log(`⚓ Serveur prêt sur le port ${PORT}`);
});
