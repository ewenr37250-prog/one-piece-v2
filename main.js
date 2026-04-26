// main.js — Le Cheuvreuil

const socket = io();

let currentPlayer = null;
let currentGrade = "player";

const $ = (id) => document.getElementById(id);
const show = (el) => el.classList.remove("hidden");
const hide = (el) => el.classList.add("hidden");

/* ============================================================
   TABS AUTH
============================================================ */
$("tab-login").onclick = () => {
    $("tab-login").classList.add("active");
    $("tab-register").classList.remove("active");
    show($("login-panel"));
    hide($("register-panel"));
};

$("tab-register").onclick = () => {
    $("tab-register").classList.add("active");
    $("tab-login").classList.remove("active");
    show($("register-panel"));
    hide($("login-panel"));
};

/* ============================================================
   AUTH
============================================================ */
$("btn-register").onclick = () => {
    socket.emit("auth:register", {
        name: $("reg-name").value,
        password: $("reg-pass").value,
        faction: $("reg-faction").value,
        classe: $("reg-classe").value
    });
};

$("btn-login").onclick = () => {
    socket.emit("auth:login", {
        name: $("log-name").value,
        password: $("log-pass").value
    });
};

socket.on("auth:error", (msg) => {
    $("auth-error").textContent = msg;
});

socket.on("auth:success", ({ player }) => {
    currentPlayer = player;
    $("auth-error").textContent = "";
    hide($("auth"));
    show($("game"));
    applyFactionTheme(player.faction);
    renderPlayer();
    renderSkills();
});

/* ============================================================
   THEMES FACTION
============================================================ */
function applyFactionTheme(faction) {
    const body = document.body;
    if (!faction) {
        body.className = "theme-login";
        return;
    }
    const f = faction.toLowerCase();
    if (f.includes("marine")) body.className = "theme-marine";
    else if (f.includes("pirate")) body.className = "theme-pirate";
    else if (f.includes("revo")) body.className = "theme-revo";
    else body.className = "theme-login";
}

/* ============================================================
   PLAYER
============================================================ */
function renderPlayer() {
    if (!currentPlayer) return;

    $("player-info").innerHTML =
        `<b>${currentPlayer.name}</b> — ${currentPlayer.faction} / ${currentPlayer.classe}`;

    $("player-stats").innerHTML = `
        Niveau : ${currentPlayer.level}<br>
        XP : ${currentPlayer.xp}<br>
        Berries : ${currentPlayer.berries} ฿<br>
        Prime : ${currentPlayer.bounty} ฿<br>
        Points de talent : ${currentPlayer.skillTree.talentPoints}
    `;
}

socket.on("player:update", (player) => {
    if (currentPlayer && player.name === currentPlayer.name) {
        currentPlayer = player;
        renderPlayer();
        renderSkills();
    }
});

/* ============================================================
   ACTIONS
============================================================ */
$("btn-train").onclick = () => {
    socket.emit("action:train");
};

socket.on("action:result", ({ text }) => {
    $("action-result").textContent = text;
});

socket.on("action:cooldown", ({ remaining }) => {
    $("action-result").textContent =
        `Encore ${Math.ceil(remaining / 1000)}s avant de pouvoir t'entraîner.`;
});

/* ============================================================
   QUÊTES
============================================================ */
$("btn-quest-faction").onclick = () => {
    socket.emit("quest:request_faction");
};

$("btn-quest-class").onclick = () => {
    socket.emit("quest:request_class");
};

socket.on("quest:faction_update", (q) => {
    $("quest-info").innerHTML = `
        <b>Quête Faction :</b> ${q.title}<br>
        Objectif : ${q.goal}<br>
        Progression : ${q.progress ?? 0}
    `;
});

socket.on("quest:class_update", (q) => {
    $("quest-info").innerHTML += `
        <hr>
        <b>Quête Classe :</b> ${q.title}<br>
        Objectif : ${q.goal}<br>
        Progression : ${q.progress ?? 0}
    `;
});

/* ============================================================
   SKILLS
============================================================ */
function renderSkills() {
    if (!currentPlayer) return;

    const tree = currentPlayer.skillTree;
    const container = $("skills");
    container.innerHTML = "";

    Object.entries(tree.branches).forEach(([branch, level]) => {
        const btn = document.createElement("button");
        btn.className = "btn";
        btn.textContent = `${branch} (${level}/${tree.maxLevel})`;
        btn.onclick = () => {
            socket.emit("skill:upgrade", { branch });
        };
        container.appendChild(btn);
    });
}

socket.on("skill:update", (tree) => {
    currentPlayer.skillTree = tree;
    renderPlayer();
    renderSkills();
});

socket.on("skill:error", (msg) => {
    $("action-result").textContent = msg;
});

/* ============================================================
   CHAT GLOBAL
============================================================ */
$("chat-send").onclick = () => {
    const text = $("chat-text").value.trim();
    if (!text) return;
    socket.emit("chat:send", { text });
    $("chat-text").value = "";
};

socket.on("chat:message", ({ author, text }) => {
    const log = $("chat-log");
    const line = document.createElement("div");
    line.innerHTML = `<b>${author}</b> : ${text}`;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
});

/* ============================================================
   EVENTS
============================================================ */
socket.on("events:current", (ev) => {
    if (!ev) {
        $("event-current").textContent = "Aucun événement en cours.";
        return;
    }
    $("event-current").textContent = `🔥 ${ev.title} — ${ev.text}`;
});

socket.on("events:history", (history) => {
    $("event-history").innerHTML = history
        .map((e) => e.text)
        .join("<br>");
});

/* ============================================================
   MODO / ADMIN
============================================================ */
$("btn-modo-login").onclick = () => {
    socket.emit("modo:login", $("modo-code").value);
};

socket.on("modo:success", () => {
    currentGrade = "modo";
    $("grade-info").textContent = `Grade : ${currentGrade}`;
    appendModoLog("Accès modo accordé.");
});

socket.on("modo:fail", () => {
    appendModoLog("Code modo refusé.");
});

socket.on("modo:log", (text) => appendModoLog(text));
socket.on("admin:info", (text) => appendAdminLog(text));

function appendModoLog(text) {
    const log = $("modo-log");
    const line = document.createElement("div");
    line.textContent = text;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
}

function appendAdminLog(text) {
    const log = $("admin-log");
    const line = document.createElement("div");
    line.textContent = text;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
}

/* Modo actions */
$("btn-modo-give").onclick = () => {
    socket.emit("modo:give_berries", {
        target: $("modo-target").value,
        amount: Number($("modo-berries").value)
    });
};

$("btn-modo-kick").onclick = () => {
    socket.emit("modo:kick", {
        target: $("modo-target").value
    });
};

/* Admin actions */
$("btn-admin-set-grade").onclick = () => {
    socket.emit("admin:set_grade", {
        target: $("admin-target").value,
        grade: $("admin-grade").value
    });
};

$("btn-admin-qf").onclick = () => {
    socket.emit("admin:create_quest", {
        type: "faction",
        title: $("qf-title").value,
        desc: $("qf-desc").value,
        goal: Number($("qf-goal").value),
        rewardXP: Number($("qf-rxp").value),
        rewardBerries: Number($("qf-rb").value)
    });
};

$("btn-admin-qc").onclick = () => {
    socket.emit("admin:create_quest", {
        type: "class",
        title: $("qc-title").value,
        desc: $("qc-desc").value,
        goal: Number($("qc-goal").value),
        rewardXP: Number($("qc-rxp").value),
        rewardTalent: Number($("qc-rt").value)
    });
};

$("btn-admin-start-event").onclick = () => {
    socket.emit("admin:start_event", {
        title: $("ev-title").value,
        desc: $("ev-desc").value
    });
};

$("btn-admin-stop-event").onclick = () => {
    socket.emit("admin:stop_event");
};

$("btn-admin-reset").onclick = () => {
    socket.emit("admin:reset_player", {
        target: $("admin-reset-target").value
    });
};
