// server.js — Bloc 1/5 : Core + Données + Utilitaires

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

/* ============================================================
   SERVE STATIC
   ============================================================ */
app.use(express.static(path.join(__dirname, ".")));

/* ============================================================
   STRUCTURES DE DONNÉES
   ============================================================ */

// Utilisateurs enregistrés
const users = new Map(); // name -> { name, password, faction, classe }

// Joueurs connectés
const playersBySocket = new Map(); // socket.id -> player
const playersByName = new Map();   // name -> player

// Grades : "player" | "modo" | "admin"
const GRADES = {};

// Quêtes globales
let currentFactionQuest = null;
let currentClassQuest = null;

// Événements RP
let currentEvent = null;
let eventsHistory = [];

// Cooldowns
const actionCooldowns = {}; // "name:action" -> timestamp

// Code modo RP
const DEN_DEN_MODO_KEY = "PANTHEON_OP";

/* ============================================================
   PLAYER MODEL
   ============================================================ */

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

/* ============================================================
   UTILITAIRES GLOBAUX
   ============================================================ */

function giveXP(player, amount) {
    player.xp += amount;
    while (player.xp >= 100) {
        player.xp -= 100;
        player.level += 1;
        player.skillTree.talentPoints += 1;
    }
}

function isOnCooldown(player, action, ms) {
    const key = `${player.name}:${action}`;
    const now = Date.now();
    const last = actionCooldowns[key] || 0;

    if (now - last < ms) {
        return ms - (now - last);
    }

    actionCooldowns[key] = now;
    return 0;
}

function isAdmin(player) {
    return GRADES[player.name] === "admin";
}

function isModo(player) {
    const g = GRADES[player.name];
    return g === "modo" || g === "admin";
}

function findSocket(name) {
    for (const [sid, p] of playersBySocket.entries()) {
        if (p.name === name) return io.sockets.sockets.get(sid);
    }
    return null;
}

function broadcastPlayer(player) {
    for (const [sid, p] of playersBySocket.entries()) {
        if (p.name === player.name) {
            io.to(sid).emit("player:update", player);
        }
    }
}
// server.js — Bloc 2/5 : Auth + Connexion + Déconnexion

io.on("connection", (socket) => {
    console.log(`📡 Nouveau Den-Den connecté : ${socket.id}`);

    /* ============================================================
       AUTH — REGISTER
       ============================================================ */
    socket.on("auth:register", ({ name, password, faction, classe }) => {

        if (!name?.trim() || !password) {
            return socket.emit("auth:error", "Nom ou mot de passe manquant.");
        }

        if (users.has(name)) {
            return socket.emit("auth:error", "Ce nom est déjà pris.");
        }

        const userData = {
            name: name.trim(),
            password,
            faction: faction || "pirate",
            classe: classe || "novice"
        };

        users.set(name, userData);

        const player = createPlayer(userData);
        playersBySocket.set(socket.id, player);
        playersByName.set(name, player);

        if (!GRADES[name]) GRADES[name] = "player";

        socket.emit("auth:success", { player });
        console.log(`🆕 Inscription : ${name}`);
    });

    /* ============================================================
       AUTH — LOGIN
       ============================================================ */
    socket.on("auth:login", ({ name, password }) => {
        const userData = users.get(name);

        if (!userData || userData.password !== password) {
            return socket.emit("auth:error", "Identifiants invalides.");
        }

        let player = playersByName.get(name);
        if (!player) {
            player = createPlayer(userData);
            playersByName.set(name, player);
        }

        playersBySocket.set(socket.id, player);

        socket.emit("auth:success", { player });
        console.log(`🔓 Connexion : ${name}`);
    });

    /* ============================================================
       ENVOI DES EVENTS À LA CONNEXION
       ============================================================ */
    socket.emit("events:current", currentEvent || null);
    socket.emit("events:history", eventsHistory);

    /* ============================================================
       DÉCONNEXION
       ============================================================ */
    socket.on("disconnect", () => {
        playersBySocket.delete(socket.id);
        console.log(`❌ Déconnexion : ${socket.id}`);
    });
});
// server.js — Bloc 3/5 : Gameplay (XP, Skills, Quêtes)

/* ============================================================
   ACTION : TRAIN
   ============================================================ */
io.on("connection", (socket) => {

    socket.on("action:train", () => {
        const player = playersBySocket.get(socket.id);
        if (!player) return;

        const remaining = isOnCooldown(player, "train", 5000);
        if (remaining > 0) {
            return socket.emit("action:cooldown", {
                action: "train",
                remaining
            });
        }

        const xpGain = 10;
        giveXP(player, xpGain);
        player.berries += 5;

        socket.emit("action:result", {
            text: `💪 Tu t'entraînes et gagnes ${xpGain} XP et 5 ฿.`
        });

        broadcastPlayer(player);
    });

    /* ============================================================
       PROGRESSION DES QUÊTES
       ============================================================ */
    socket.on("action:quest_progress", ({ type }) => {
        const player = playersBySocket.get(socket.id);
        if (!player) return;

        /* ------------------ QUÊTE DE FACTION ------------------ */
        if (type === "faction" && player.factionQuest && currentFactionQuest) {

            player.factionQuest.progress = Math.min(
                player.factionQuest.progress + 1,
                player.factionQuest.goal
            );

            if (player.factionQuest.progress >= player.factionQuest.goal) {

                giveXP(player, currentFactionQuest.rewardXP || 0);
                player.berries += currentFactionQuest.rewardBerries || 0;

                socket.emit("action:result", {
                    text: `🏴‍☠️ Quête de faction terminée ! +${currentFactionQuest.rewardXP || 0} XP, +${currentFactionQuest.rewardBerries || 0} ฿`
                });

                player.factionQuest = null;

            } else {
                socket.emit("action:result", {
                    text: `Progression : ${player.factionQuest.progress}/${player.factionQuest.goal}`
                });
            }

            return broadcastPlayer(player);
        }

        /* ------------------ QUÊTE DE CLASSE ------------------ */
        if (type === "class" && player.classQuest && currentClassQuest) {

            player.classQuest.progress = Math.min(
                player.classQuest.progress + 1,
                player.classQuest.goal
            );

            if (player.classQuest.progress >= player.classQuest.goal) {

                giveXP(player, currentClassQuest.rewardXP || 0);
                player.skillTree.talentPoints += currentClassQuest.rewardTalent || 0;

                socket.emit("action:result", {
                    text: `🎓 Quête de classe terminée ! +${currentClassQuest.rewardXP || 0} XP, +${currentClassQuest.rewardTalent || 0} PT`
                });

                player.classQuest = null;

            } else {
                socket.emit("action:result", {
                    text: `Progression : ${player.classQuest.progress}/${player.classQuest.goal}`
                });
            }

            return broadcastPlayer(player);
        }
    });

    /* ============================================================
       DEMANDE DE QUÊTE DE FACTION
       ============================================================ */
    socket.on("quest:request_faction", () => {
        const player = playersBySocket.get(socket.id);
        if (!player) return;

        if (!currentFactionQuest) {
            return socket.emit("action:result", {
                text: "Aucune quête de faction n'est active."
            });
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

        broadcastPlayer(player);
    });

    /* ============================================================
       DEMANDE DE QUÊTE DE CLASSE
       ============================================================ */
    socket.on("quest:request_class", () => {
        const player = playersBySocket.get(socket.id);
        if (!player) return;

        if (!currentClassQuest) {
            return socket.emit("action:result", {
                text: "Aucune quête de classe n'est active."
            });
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

        broadcastPlayer(player);
    });

    /* ============================================================
       SKILLS / TALENT TREE
       ============================================================ */
    socket.on("skill:upgrade", ({ branch }) => {
        const player = playersBySocket.get(socket.id);
        if (!player) return;

        const tree = player.skillTree;

        if (!(branch in tree.branches)) {
            return socket.emit("skill:error", "Branche invalide.");
        }

        if (tree.talentPoints <= 0) {
            return socket.emit("skill:error", "Pas assez de points de talent.");
        }

        if (tree.branches[branch] >= tree.maxLevel) {
            return socket.emit("skill:error", "Niveau maximum atteint.");
        }

        tree.branches[branch] += 1;
        tree.talentPoints -= 1;

        socket.emit("skill:update", tree);
        broadcastPlayer(player);
    });

});
// server.js — Bloc 4/5 : Escargophone (Faction / Privé / HRP)

/* ============================================================
   HISTORIQUE ESCARGOPHONE
   ============================================================ */

const chatHistory = {
    faction: {},   // faction -> [ { author, text, ts } ]
    prive: {},     // "A__B" -> [ { author, text, ts } ]
    hrp: []        // global HRP
};

const MAX_HISTORY = 50;

/* Génère une clé unique pour un canal privé */
function privKey(a, b) {
    return [a, b].sort().join("__");
}

/* Ajoute un message dans l’historique */
function pushHistory(type, key, msg) {
    if (type === "faction") {
        if (!chatHistory.faction[key]) chatHistory.faction[key] = [];
        chatHistory.faction[key].push(msg);
        if (chatHistory.faction[key].length > MAX_HISTORY)
            chatHistory.faction[key].shift();
    }

    else if (type === "prive") {
        if (!chatHistory.prive[key]) chatHistory.prive[key] = [];
        chatHistory.prive[key].push(msg);
        if (chatHistory.prive[key].length > MAX_HISTORY)
            chatHistory.prive[key].shift();
    }

    else if (type === "hrp") {
        chatHistory.hrp.push(msg);
        if (chatHistory.hrp.length > MAX_HISTORY)
            chatHistory.hrp.shift();
    }
}

/* ============================================================
   ESCARGOPHONE — FACTION
   ============================================================ */

io.on("connection", (socket) => {

    socket.on("esc:faction:send", ({ text }) => {
        const player = playersBySocket.get(socket.id);
        if (!player || !text?.trim()) return;

        const msg = {
            author: player.name,
            faction: player.faction,
            text: text.trim(),
            ts: Date.now()
        };

        pushHistory("faction", player.faction, msg);

        // Envoi uniquement aux membres de la même faction
        for (const [sid, p] of playersBySocket.entries()) {
            if (p.faction === player.faction) {
                io.to(sid).emit("esc:faction:message", msg);
            }
        }
    });

    /* ============================================================
       ESCARGOPHONE — PRIVÉ (APPELS + MESSAGES)
       ============================================================ */

    // Appel entrant
    socket.on("esc:prive:call", ({ target }) => {
        const player = playersBySocket.get(socket.id);
        if (!player) return;

        const targetSocket = findSocket(target);
        if (!targetSocket) {
            return socket.emit("esc:prive:unavailable", { target });
        }

        targetSocket.emit("esc:prive:incoming", { from: player.name });
        socket.emit("esc:prive:calling", { target });
    });

    // Acceptation d’appel
    socket.on("esc:prive:accept", ({ from }) => {
        const player = playersBySocket.get(socket.id);
        if (!player) return;

        const callerSocket = findSocket(from);
        if (!callerSocket) return;

        const key = privKey(player.name, from);
        const history = chatHistory.prive[key] || [];

        socket.emit("esc:prive:connected", { with: from, history });
        callerSocket.emit("esc:prive:connected", { with: player.name, history });
    });

    // Envoi de message privé
    socket.on("esc:prive:send", ({ to, text }) => {
        const player = playersBySocket.get(socket.id);
        if (!player || !text?.trim()) return;

        const msg = {
            author: player.name,
            text: text.trim(),
            ts: Date.now()
        };

        const key = privKey(player.name, to);
        pushHistory("prive", key, msg);

        socket.emit("esc:prive:message", msg);
        findSocket(to)?.emit("esc:prive:message", msg);
    });

    // Raccrocher
    socket.on("esc:prive:hangup", ({ with: other }) => {
        const player = playersBySocket.get(socket.id);
        if (!player) return;

        findSocket(other)?.emit("esc:prive:hangup", { by: player.name });
        socket.emit("esc:prive:hangup", { by: player.name });
    });

    /* ============================================================
       ESCARGOPHONE — HRP (GLOBAL)
       ============================================================ */

    socket.on("esc:hrp:send", ({ text }) => {
        const player = playersBySocket.get(socket.id);
        if (!player || !text?.trim()) return;

        const msg = {
            author: player.name,
            faction: player.faction,
            text: text.trim(),
            ts: Date.now()
        };

        pushHistory("hrp", null, msg);
        io.emit("esc:hrp:message", msg);
    });

});
// server.js — Bloc 5/5 : Modo/Admin + Events + Finalisation

io.on("connection", (socket) => {

    /* ============================================================
       MODO LOGIN — ACCÈS PANTHÉON (RP)
       ============================================================ */
    socket.on("modo:login", (code) => {
        const player = playersBySocket.get(socket.id);
        if (!player) return;

        if (code === DEN_DEN_MODO_KEY) {

            // Si pas admin, devient modo
            if (GRADES[player.name] !== "admin") {
                GRADES[player.name] = "modo";
            }

            socket.emit("modo:success", {
                grade: GRADES[player.name],
                message: `📡 Accès Panthéon accordé à ${player.name}.`
            });

            socket.emit("modo:log",
                `🔱 [PANTHÉON] Canal sécurisé ouvert par ${player.name}.`
            );

        } else {
            socket.emit("modo:fail", {
                message: "❌ Code Den-Den refusé."
            });
        }
    });

    /* ============================================================
       MODO : GIVE BERRIES
       ============================================================ */
    socket.on("modo:give_berries", ({ target, amount }) => {
        const player = playersBySocket.get(socket.id);
        if (!player || !isModo(player)) return;

        const tp = playersByName.get(target);
        if (!tp) {
            return socket.emit("modo:log", `Introuvable : ${target}`);
        }

        tp.berries += Number(amount) || 0;
        broadcastPlayer(tp);

        socket.emit("modo:log", `💰 +${amount} ฿ donnés à ${target}`);
    });

    /* ============================================================
       MODO : MUTE / UNMUTE
       ============================================================ */
    const mutedPlayers = new Set();

    socket.on("modo:mute", ({ target }) => {
        const player = playersBySocket.get(socket.id);
        if (!player || !isModo(player)) return;

        mutedPlayers.add(target);
        findSocket(target)?.emit("esc:error", "🔇 Vous avez été réduit au silence par un modérateur.");

        socket.emit("modo:log", `${target} est maintenant muet.`);
    });

    socket.on("modo:unmute", ({ target }) => {
        const player = playersBySocket.get(socket.id);
        if (!player || !isModo(player)) return;

        mutedPlayers.delete(target);
        socket.emit("modo:log", `${target} peut de nouveau parler.`);
    });

    /* ============================================================
       MODO : KICK
       ============================================================ */
    socket.on("modo:kick", ({ target }) => {
        const player = playersBySocket.get(socket.id);
        if (!player || !isModo(player)) return;

        const s = findSocket(target);
        if (s) {
            s.emit("auth:error", "🚫 Vous avez été expulsé par un modérateur.");
            s.disconnect(true);
        }

        playersByName.delete(target);
        socket.emit("modo:log", `👢 ${target} expulsé.`);
    });

    /* ============================================================
       MODO : ANNONCE GLOBALE
       ============================================================ */
    socket.on("modo:announce", ({ text }) => {
        const player = playersBySocket.get(socket.id);
        if (!player || !isModo(player) || !text?.trim()) return;

        io.emit("modo:announce", {
            text: text.trim(),
            author: player.name
        });
    });

    /* ============================================================
       ADMIN : SET GRADE
       ============================================================ */
    socket.on("admin:set_grade", ({ target, grade }) => {
        const player = playersBySocket.get(socket.id);
        if (!player || !isAdmin(player)) return;

        if (!["player", "modo", "admin"].includes(grade)) return;

        GRADES[target] = grade;

        socket.emit("admin:info", `🎖️ Grade de ${target} → ${grade}`);
        findSocket(target)?.emit("admin:grade_update", { grade });
    });

    /* ============================================================
       ADMIN : CREATE QUEST
       ============================================================ */
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

            io.emit("quest:faction_update", { ...currentFactionQuest, progress: 0 });
            socket.emit("admin:info", `🏴‍☠️ Quête faction définie : ${q.title}`);
        }

        if (q.type === "class") {
            currentClassQuest = {
                title: q.title,
                description: q.desc,
                goal: q.goal,
                rewardXP: q.rewardXP,
                rewardTalent: q.rewardTalent
            };

            io.emit("quest:class_update", { ...currentClassQuest, progress: 0 });
            socket.emit("admin:info", `🎓 Quête classe définie : ${q.title}`);
        }
    });

    /* ============================================================
       ADMIN : START EVENT
       ============================================================ */
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

        socket.emit("admin:info", `🔥 Événement lancé : ${title}`);
    });

    /* ============================================================
       ADMIN : STOP EVENT
       ============================================================ */
    socket.on("admin:stop_event", () => {
        const player = playersBySocket.get(socket.id);
        if (!player || !isAdmin(player)) return;

        if (currentEvent) {
            eventsHistory.push({ text: `[FIN] ${currentEvent.title}` });
        }

        currentEvent = null;

        io.emit("events:current", null);
        io.emit("events:history", eventsHistory);

        socket.emit("admin:info", "🛑 Événement arrêté.");
    });

    /* ============================================================
       ADMIN : RESET PLAYER
       ============================================================ */
    socket.on("admin:reset_player", ({ target }) => {
        const player = playersBySocket.get(socket.id);
        if (!player || !isAdmin(player)) return;

        const tp = playersByName.get(target);
        if (!tp) {
            return socket.emit("admin:info", `Introuvable : ${target}`);
        }

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

        socket.emit("admin:info", `🔄 Stats de ${target} réinitialisées.`);
    });

});

/* ============================================================
   START SERVER
   ============================================================ */
server.listen(PORT, () => {
    console.log(`🚀 Serveur lancé sur le port ${PORT}`);
});
