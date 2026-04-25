// server.js — Bloc 1/5 : Core + Données + Utilitaires

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, ".")));

// --- DATA ---
const users = new Map();
const playersBySocket = new Map();
const playersByName = new Map();
const GRADES = {};

let currentFactionQuest = null;
let currentClassQuest = null;

let currentEvent = null;
let eventsHistory = [];

const actionCooldowns = {};
const DEN_DEN_MODO_KEY = "PANTHEON_OP";

// --- PLAYER MODEL ---
function createPlayer(userData) {
    return {
        name: userData.name,
        faction: userData.faction,
        classe: userData.classe,
        level: 1,
        xp: 0,
        berries: 0,
        bounty: 0,
        skillTree: {
            talentPoints: 0,
            maxLevel: 5,
            branches: { Force: 0, Agilité: 0, Endurance: 0, Haki: 0 }
        },
        factionQuest: null,
        classQuest: null
    };
}

// --- UTILS ---
function giveXP(player, amount) {
    player.xp += amount;
    while (player.xp >= 100) {
        player.xp -= 100;
        player.level++;
        player.skillTree.talentPoints++;
    }
}

function isOnCooldown(player, action, ms) {
    const key = `${player.name}:${action}`;
    const now = Date.now();
    const last = actionCooldowns[key] || 0;
    if (now - last < ms) return ms - (now - last);
    actionCooldowns[key] = now;
    return 0;
}

function isAdmin(p) { return GRADES[p.name] === "admin"; }
function isModo(p) { return GRADES[p.name] === "modo" || GRADES[p.name] === "admin"; }

function findSocket(name) {
    for (const [sid, p] of playersBySocket.entries()) {
        if (p.name === name) return io.sockets.sockets.get(sid);
    }
    return null;
}

function broadcastPlayer(player) {
    for (const [sid, p] of playersBySocket.entries()) {
        if (p.name === player.name) io.to(sid).emit("player:update", player);
    }
}
// server.js — Bloc 2/5 : Auth + Connexion + Déconnexion

io.on("connection", (socket) => {

    socket.on("auth:register", ({ name, password, faction, classe }) => {
        if (!name || !password) return socket.emit("auth:error", "Nom ou mot de passe manquant.");
        if (users.has(name)) return socket.emit("auth:error", "Ce nom est déjà pris.");

        const userData = { name, password, faction, classe };
        users.set(name, userData);

        const player = createPlayer(userData);
        playersBySocket.set(socket.id, player);
        playersByName.set(name, player);
        GRADES[name] = "player";

        socket.emit("auth:success", { player });
    });

    socket.on("auth:login", ({ name, password }) => {
        const userData = users.get(name);
        if (!userData || userData.password !== password)
            return socket.emit("auth:error", "Identifiants invalides.");

        let player = playersByName.get(name);
        if (!player) {
            player = createPlayer(userData);
            playersByName.set(name, player);
        }

        playersBySocket.set(socket.id, player);
        socket.emit("auth:success", { player });
    });

    socket.emit("events:current", currentEvent || null);
    socket.emit("events:history", eventsHistory);

    socket.on("disconnect", () => {
        playersBySocket.delete(socket.id);
    });
});
// server.js — Bloc 3/5 : Gameplay

io.on("connection", (socket) => {

    socket.on("action:train", () => {
        const p = playersBySocket.get(socket.id);
        if (!p) return;

        const cd = isOnCooldown(p, "train", 5000);
        if (cd > 0) return socket.emit("action:cooldown", { remaining: cd });

        giveXP(p, 10);
        p.berries += 5;

        socket.emit("action:result", { text: "Tu t'entraînes et gagnes 10 XP et 5 ฿." });
        broadcastPlayer(p);
    });

    socket.on("quest:request_faction", () => {
        const p = playersBySocket.get(socket.id);
        if (!p) return;

        if (!currentFactionQuest)
            return socket.emit("action:result", { text: "Aucune quête de faction active." });

        if (!p.factionQuest)
            p.factionQuest = { title: currentFactionQuest.title, goal: currentFactionQuest.goal, progress: 0 };

        socket.emit("quest:faction_update", { ...currentFactionQuest, progress: p.factionQuest.progress });
        broadcastPlayer(p);
    });

    socket.on("quest:request_class", () => {
        const p = playersBySocket.get(socket.id);
        if (!p) return;

        if (!currentClassQuest)
            return socket.emit("action:result", { text: "Aucune quête de classe active." });

        if (!p.classQuest)
            p.classQuest = { title: currentClassQuest.title, goal: currentClassQuest.goal, progress: 0 };

        socket.emit("quest:class_update", { ...currentClassQuest, progress: p.classQuest.progress });
        broadcastPlayer(p);
    });

    socket.on("action:quest_progress", ({ type }) => {
        const p = playersBySocket.get(socket.id);
        if (!p) return;

        if (type === "faction" && p.factionQuest && currentFactionQuest) {
            p.factionQuest.progress++;
            if (p.factionQuest.progress >= p.factionQuest.goal) {
                giveXP(p, currentFactionQuest.rewardXP || 0);
                p.berries += currentFactionQuest.rewardBerries || 0;
                p.factionQuest = null;
            }
            broadcastPlayer(p);
        }

        if (type === "class" && p.classQuest && currentClassQuest) {
            p.classQuest.progress++;
            if (p.classQuest.progress >= p.classQuest.goal) {
                giveXP(p, currentClassQuest.rewardXP || 0);
                p.skillTree.talentPoints += currentClassQuest.rewardTalent || 0;
                p.classQuest = null;
            }
            broadcastPlayer(p);
        }
    });

    socket.on("skill:upgrade", ({ branch }) => {
        const p = playersBySocket.get(socket.id);
        if (!p) return;

        const tree = p.skillTree;
        if (!(branch in tree.branches)) return;
        if (tree.talentPoints <= 0) return socket.emit("skill:error", "Pas assez de points.");
        if (tree.branches[branch] >= tree.maxLevel) return socket.emit("skill:error", "Niveau max.");

        tree.branches[branch]++;
        tree.talentPoints--;
        socket.emit("skill:update", tree);
        broadcastPlayer(p);
    });
});
// server.js — Bloc 4/5 : Chat Global

io.on("connection", (socket) => {

    socket.on("chat:send", ({ text }) => {
        const p = playersBySocket.get(socket.id);
        if (!p || !text) return;

        io.emit("chat:message", { author: p.name, text });
    });

});
// server.js — Bloc 5/5 : Modo / Admin / Events

io.on("connection", (socket) => {

    socket.on("modo:login", (code) => {
        const p = playersBySocket.get(socket.id);
        if (!p) return;

        if (code === DEN_DEN_MODO_KEY) {
            if (GRADES[p.name] !== "admin") GRADES[p.name] = "modo";
            socket.emit("modo:success");
            socket.emit("modo:log", `Accès modo accordé à ${p.name}`);
        } else {
            socket.emit("modo:fail");
        }
    });

    socket.on("modo:give_berries", ({ target, amount }) => {
        const p = playersBySocket.get(socket.id);
        if (!p || !isModo(p)) return;

        const tp = playersByName.get(target);
        if (!tp) return socket.emit("modo:log", "Joueur introuvable.");

        tp.berries += Number(amount);
        broadcastPlayer(tp);
        socket.emit("modo:log", `+${amount} ฿ donnés à ${target}`);
    });

    socket.on("modo:kick", ({ target }) => {
        const p = playersBySocket.get(socket.id);
        if (!p || !isModo(p)) return;

        const s = findSocket(target);
        if (s) {
            s.emit("auth:error", "Vous avez été expulsé.");
            s.disconnect(true);
        }
        socket.emit("modo:log", `${target} expulsé.`);
    });

    socket.on("admin:set_grade", ({ target, grade }) => {
        const p = playersBySocket.get(socket.id);
        if (!p || !isAdmin(p)) return;

        GRADES[target] = grade;
        socket.emit("admin:info", `Grade de ${target} → ${grade}`);
        findSocket(target)?.emit("admin:grade_update", { grade });
    });

    socket.on("admin:create_quest", (q) => {
        const p = playersBySocket.get(socket.id);
        if (!p || !isAdmin(p)) return;

        if (q.type === "faction") {
            currentFactionQuest = q;
            io.emit("quest:faction_update", { ...q, progress: 0 });
        }
        if (q.type === "class") {
            currentClassQuest = q;
            io.emit("quest:class_update", { ...q, progress: 0 });
        }

        socket.emit("admin:info", `Quête ${q.type} définie : ${q.title}`);
    });

    socket.on("admin:start_event", ({ title, desc }) => {
        const p = playersBySocket.get(socket.id);
        if (!p || !isAdmin(p)) return;

        currentEvent = { title, text: desc, startedAt: Date.now() };
        eventsHistory.push({ text: `[EVENT] ${title} : ${desc}` });

        io.emit("events:current", currentEvent);
        io.emit("events:history", eventsHistory);
    });

    socket.on("admin:stop_event", () => {
        const p = playersBySocket.get(socket.id);
        if (!p || !isAdmin(p)) return;

        if (currentEvent)
            eventsHistory.push({ text: `[FIN] ${currentEvent.title}` });

        currentEvent = null;

        io.emit("events:current", null);
        io.emit("events:history", eventsHistory);
    });

    socket.on("admin:reset_player", ({ target }) => {
        const p = playersBySocket.get(socket.id);
        if (!p || !isAdmin(p)) return;

        const tp = playersByName.get(target);
        if (!tp) return socket.emit("admin:info", "Introuvable.");

        tp.level = 1;
        tp.xp = 0;
        tp.berries = 0;
        tp.bounty = 0;
        tp.skillTree = {
            talentPoints: 0,
            maxLevel: 5,
            branches: { Force: 0, Agilité: 0, Endurance: 0, Haki: 0 }
        };
        tp.factionQuest = null;
        tp.classQuest = null;

        broadcastPlayer(tp);
        socket.emit("admin:info", `Stats de ${target} réinitialisées.`);
    });

});

server.listen(PORT, () => {
    console.log("Serveur Le Cheuvreuil lancé sur le port", PORT);
});
