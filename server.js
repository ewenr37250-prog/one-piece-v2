// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// ----------------- SERVE STATIC -----------------
app.use(express.static(path.join(__dirname, ".")));

// ----------------- DATA STRUCTURES -----------------

// users enregistrés (simple, en mémoire)
const users = new Map(); // name -> { name, password, faction, classe }

// joueurs connectés
const playersBySocket = new Map(); // socket.id -> player
const playersByName = new Map();   // name -> player

// grades : playerName -> "player" | "modo" | "admin"
const GRADES = {};

// quêtes globales
let currentFactionQuest = null;
let currentClassQuest = null;

// événements
let currentEvent = null;
let eventsHistory = [];

// cooldowns actions (par joueur)
const actionCooldowns = {}; // key: playerName + ":" + action -> timestamp

// code modo de base
const MODO_CODE = "PANTHEON_OP";

// ----------------- HELPERS -----------------

function createNewPlayer(userData) {
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
            branches: {
                Force: 0,
                Agilité: 0,
                Endurance: 0,
                Haki: 0
            }
        },
        factionQuest: null,
        classQuest: null
    };
}

function giveXP(player, amount) {
    player.xp += amount;
    while (player.xp >= 100) {
        player.xp -= 100;
        player.level += 1;
        player.skillTree.talentPoints += 1;
    }
}

function isOnCooldown(player, action, ms) {
    const key = player.name + ":" + action;
    const now = Date.now();
    const last = actionCooldowns[key] || 0;
    if (now - last < ms) {
        return ms - (now - last);
    }
    actionCooldowns[key] = now;
    return 0;
}

function isAdmin(player) {
    const g = GRADES[player.name];
    return g === "admin";
}

function isModoOrAdmin(player) {
    const g = GRADES[player.name];
    return g === "admin" || g === "modo";
}

function broadcastPlayerUpdate(player) {
    // on retrouve tous les sockets de ce joueur
    for (const [sid, p] of playersBySocket.entries()) {
        if (p.name === player.name) {
            io.to(sid).emit("player:update", player);
        }
    }
}

// ----------------- SOCKET.IO -----------------

io.on("connection", (socket) => {
    console.log("Client connecté:", socket.id);

    // -------- AUTH --------

    socket.on("auth:register", ({ name, password, faction, classe }) => {
        if (!name || !password) {
            socket.emit("auth:error", "Nom ou mot de passe manquant.");
            return;
        }
        if (users.has(name)) {
            socket.emit("auth:error", "Ce nom est déjà pris.");
            return;
        }
        const userData = { name, password, faction, classe };
        users.set(name, userData);

        const player = createNewPlayer(userData);
        playersBySocket.set(socket.id, player);
        playersByName.set(name, player);
        if (!GRADES[name]) GRADES[name] = "player";

        socket.emit("auth:success", { player });
        console.log(`Inscription: ${name}`);
    });

    socket.on("auth:login", ({ name, password }) => {
        const userData = users.get(name);
        if (!userData || userData.password !== password) {
            socket.emit("auth:error", "Identifiants invalides.");
            return;
        }
        let player = playersByName.get(name);
        if (!player) {
            player = createNewPlayer(userData);
            playersByName.set(name, player);
        }
        playersBySocket.set(socket.id, player);

        socket.emit("auth:success", { player });
        console.log(`Connexion: ${name}`);
    });

    // -------- ACTIONS --------

    socket.on("action:train", () => {
        const player = playersBySocket.get(socket.id);
        if (!player) return;

        const remaining = isOnCooldown(player, "train", 5000);
        if (remaining > 0) {
            socket.emit("action:cooldown", { action: "train", remaining });
            return;
        }

        const xpGain = 10;
        giveXP(player, xpGain);
        player.berries += 5;

        socket.emit("action:result", { text: `Tu t'entraînes et gagnes ${xpGain} XP et 5 ฿.` });
        broadcastPlayerUpdate(player);
    });

    socket.on("action:quest_progress", ({ type }) => {
        const player = playersBySocket.get(socket.id);
        if (!player) return;

        if (type === "faction" && player.factionQuest && currentFactionQuest) {
            player.factionQuest.progress = Math.min(
                player.factionQuest.progress + 1,
                player.factionQuest.goal
            );
            if (player.factionQuest.progress >= player.factionQuest.goal) {
                giveXP(player, currentFactionQuest.rewardXP || 0);
                player.berries += currentFactionQuest.rewardBerries || 0;
                socket.emit("action:result", {
                    text: `Quête de faction terminée ! +${currentFactionQuest.rewardXP || 0} XP, +${currentFactionQuest.rewardBerries || 0} ฿`
                });
                player.factionQuest = null;
            } else {
                socket.emit("action:result", {
                    text: `Progression quête faction : ${player.factionQuest.progress}/${player.factionQuest.goal}`
                });
            }
            broadcastPlayerUpdate(player);
        }

        if (type === "class" && player.classQuest && currentClassQuest) {
            player.classQuest.progress = Math.min(
                player.classQuest.progress + 1,
                player.classQuest.goal
            );
            if (player.classQuest.progress >= player.classQuest.goal) {
                giveXP(player, currentClassQuest.rewardXP || 0);
                player.skillTree.talentPoints += currentClassQuest.rewardTalent || 0;
                socket.emit("action:result", {
                    text: `Quête de classe terminée ! +${currentClassQuest.rewardXP || 0} XP, +${currentClassQuest.rewardTalent || 0} PT`
                });
                player.classQuest = null;
            } else {
                socket.emit("action:result", {
                    text: `Progression quête classe : ${player.classQuest.progress}/${player.classQuest.goal}`
                });
            }
            broadcastPlayerUpdate(player);
        }
    });

    // -------- QUÊTES --------

    socket.on("quest:request_faction", () => {
        const player = playersBySocket.get(socket.id);
        if (!player) return;

        if (!currentFactionQuest) {
            socket.emit("action:result", { text: "Aucune quête de faction définie pour le moment." });
            return;
        }

        if (!player.factionQuest) {
            player.factionQuest = {
                title: currentFactionQuest.title,
                goal: currentFactionQuest.goal,
                progress: 0
            };
        }

        socket.emit("quest:faction_update", {
            ...currentFactionQuest,
            progress: player.factionQuest.progress
        });
        broadcastPlayerUpdate(player);
    });

    socket.on("quest:request_class", () => {
        const player = playersBySocket.get(socket.id);
        if (!player) return;

        if (!currentClassQuest) {
            socket.emit("action:result", { text: "Aucune quête de classe définie pour le moment." });
            return;
        }

        if (!player.classQuest) {
            player.classQuest = {
                title: currentClassQuest.title,
                goal: currentClassQuest.goal,
                progress: 0
            };
        }

        socket.emit("quest:class_update", {
            ...currentClassQuest,
            progress: player.classQuest.progress
        });
        broadcastPlayerUpdate(player);
    });

    // -------- SKILLS --------

    socket.on("skill:upgrade", ({ branch }) => {
        const player = playersBySocket.get(socket.id);
        if (!player) return;
        const tree = player.skillTree;
        if (!tree.branches[branch]) return;
        if (tree.talentPoints <= 0) {
            socket.emit("skill:error", "Pas assez de points de talent.");
            return;
        }
        if (tree.branches[branch] >= tree.maxLevel) {
            socket.emit("skill:error", "Cette branche est déjà au niveau maximum.");
            return;
        }
        tree.branches[branch] += 1;
        tree.talentPoints -= 1;
        socket.emit("skill:update", tree);
        broadcastPlayerUpdate(player);
    });

    // -------- CHAT --------

    socket.on("chat:send", ({ text }) => {
        const player = playersBySocket.get(socket.id);
        if (!player || !text) return;
        io.emit("chat:message", { author: player.name, text });
    });

    // -------- EVENTS --------

    // envoyer l'historique et l'event courant à la connexion
    if (currentEvent) {
        socket.emit("events:current", currentEvent);
    } else {
        socket.emit("events:current", null);
    }
    socket.emit("events:history", eventsHistory);

    // -------- MODO LOGIN --------

    socket.on("modo:login", (code) => {
        const player = playersBySocket.get(socket.id);
        if (!player) return;
        if (code === MODO_CODE) {
            GRADES[player.name] = "admin"; // ou "modo" si tu veux
            socket.emit("modo:success");
            socket.emit("modo:log", `Accès modo accordé à ${player.name}`);
        } else {
            socket.emit("modo:fail");
        }
    });

    // -------- MODO ACTIONS --------

    socket.on("modo:give_berries", ({ target, amount }) => {
        const player = playersBySocket.get(socket.id);
        if (!player || !isModoOrAdmin(player)) return;
        const targetPlayer = playersByName.get(target);
        if (!targetPlayer) {
            socket.emit("modo:log", `Joueur introuvable: ${target}`);
            return;
        }
        targetPlayer.berries += amount;
        broadcastPlayerUpdate(targetPlayer);
        socket.emit("modo:log", `+${amount} ฿ donnés à ${target}`);
    });

    socket.on("modo:kick", ({ target }) => {
        const player = playersBySocket.get(socket.id);
        if (!player || !isModoOrAdmin(player)) return;

        for (const [sid, p] of playersBySocket.entries()) {
            if (p.name === target) {
                io.to(sid).emit("auth:error", "Vous avez été expulsé par un modérateur.");
                io.sockets.sockets.get(sid)?.disconnect(true);
                playersBySocket.delete(sid);
                break;
            }
        }
        socket.emit("modo:log", `Joueur kick: ${target}`);
    });

    // -------- ADMIN / PANTHÉON --------

    socket.on("admin:set_grade", ({ target, grade }) => {
        const player = playersBySocket.get(socket.id);
        if (!player || !isAdmin(player)) return;
        GRADES[target] = grade;
        socket.emit("admin:info", `Grade de ${target} défini sur ${grade}`);
    });

    socket.on("admin:create_quest", (q) => {
        const player = playersBySocket.get(socket.id);
        if (!player || !isAdmin(player)) return;

        if (q.type === "faction") {
            currentFactionQuest = {
                title: q.title,
                description: q.desc,
                goal: q.goal,
                rewardXP: q.rewardXP,
                rewardBerries: q.rewardBerries
            };
            io.emit("quest:faction_update", {
                ...currentFactionQuest,
                progress: 0
            });
            socket.emit("admin:info", `Quête de faction définie : ${q.title}`);
        } else if (q.type === "class") {
            currentClassQuest = {
                title: q.title,
                description: q.desc,
                goal: q.goal,
                rewardXP: q.rewardXP,
                rewardTalent: q.rewardTalent
            };
            io.emit("quest:class_update", {
                ...currentClassQuest,
                progress: 0
            });
            socket.emit("admin:info", `Quête de classe définie : ${q.title}`);
        }
    });

    socket.on("admin:start_event", ({ title, desc }) => {
        const player = playersBySocket.get(socket.id);
        if (!player || !isAdmin(player)) return;

        currentEvent = {
            title,
            text: desc,
            startedAt: Date.now()
        };
        eventsHistory.push({ text: `[EVENT] ${title} : ${desc}` });
        io.emit("events:current", currentEvent);
        io.emit("events:history", eventsHistory);
        socket.emit("admin:info", `Événement lancé : ${title}`);
    });

    socket.on("admin:stop_event", () => {
        const player = playersBySocket.get(socket.id);
        if (!player || !isAdmin(player)) return;

        if (currentEvent) {
            eventsHistory.push({ text: `[EVENT FIN] ${currentEvent.title}` });
        }
        currentEvent = null;
        io.emit("events:current", null);
        io.emit("events:history", eventsHistory);
        socket.emit("admin:info", "Événement arrêté.");
    });

    // -------- DISCONNECT --------

    socket.on("disconnect", () => {
        playersBySocket.delete(socket.id);
        console.log("Client déconnecté:", socket.id);
    });
});

// ----------------- START SERVER -----------------
server.listen(PORT, () => {
    console.log("Server listening on port", PORT);
});
