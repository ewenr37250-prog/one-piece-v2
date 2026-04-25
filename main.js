// main.js

const socket = io();

let currentPlayer = null;
let currentGrade = "player";

/* ============================================================
   DOM HELPERS
============================================================ */
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
    hide($("auth"));
    show($("game"));
    applyFactionTheme(player.faction);
    renderPlayer();
    renderSkills();
});

/* ============================================================
   THEMES RP (Faction)
============================================================ */
function applyFactionTheme(faction) {
    const body = document.body;

    if (faction === "marine") body.className = "theme-marine";
    else if (faction === "pirate") body.className = "theme-pirate";
    else if (faction === "revo") body.className = "theme-revo";
    else body.className = "theme-login";
}

/* ============================================================
   PLAYER RENDER
============================================================ */
function renderPlayer() {
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
$("btn-train").onclick = () => socket.emit("action:train");

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
$("btn-quest-faction").onclick = () => socket.emit("quest:request_faction");
$("btn-quest-class").onclick = () => socket.emit("quest:request_class");

socket.on("quest:faction_update", (q) => {
    $("quest-info").innerHTML = `
        <b>Quête Faction :</b> ${q.title}<br>
        Objectif : ${q.goal}<br>
        Progression : ${q.progress}
    `;
});

socket.on("quest:class_update", (q) => {
    $("quest-info").innerHTML += `
        <hr>
        <b>Quête Classe :</b> ${q.title}<br>
        Objectif : ${q.goal}<br>
        Progression : ${q.progress}
    `;
});

/* ============================================================
   SKILLS
============================================================ */
function renderSkills() {
    const tree = currentPlayer.skillTree;
    const container = $("skills");
    container.innerHTML = "";

    Object.entries(tree.branches).forEach(([branch, level]) => {
        const btn = document.createElement("button");
        btn.className = "btn";
        btn.textContent = `${branch} (${level}/${tree.maxLevel})`;
        btn.onclick = () => socket.emit("skill:upgrade", { branch });
        container.appendChild(btn);
    });
}

socket.on("skill:update", (tree) => {
    currentPlayer.skillTree = tree;
    renderPlayer();
    renderSkills();
});

/* ============================================================
   ESCARGOPHONE — TABS
============================================================ */
$("tab-faction").onclick = () => switchEsc("faction");
$("tab-prive").onclick = () => switchEsc("prive");
$("tab-hrp").onclick = () => switchEsc("hrp");

function switchEsc(type) {
    ["faction", "prive", "hrp"].forEach((t) => {
        $("tab-" + t).classList.remove("active");
        hide($("esc-" + t));
    });

    $("tab-" + type).classList.add("active");
    show($("esc-" + type));
}

/* ============================================================
   ESCARGOPHONE — FACTION
============================================================ */
$("esc-faction-send").onclick = () => {
    socket.emit("esc:faction:send", {
        text: $("esc-faction-text").value
    });
    $("esc-faction-text").value = "";
};

socket.on("esc:faction:message", (msg) => {
    const log = $("esc-faction-log");
    log.innerHTML += `<div><b>${msg.author}</b> : ${msg.text}</div>`;
    log.scrollTop = log.scrollHeight;
});

/* ============================================================
   ESCARGOPHONE — HRP
============================================================ */
$("esc-hrp-send").onclick = () => {
    socket.emit("esc:hrp:send", {
        text: $("esc-hrp-text").value
    });
    $("esc-hrp-text").value = "";
};

socket.on("esc:hrp:message", (msg) => {
    const log = $("esc-hrp-log");
    log.innerHTML += `<div><b>${msg.author}</b> : ${msg.text}</div>`;
    log.scrollTop = log.scrollHeight;
});

/* ============================================================
   ESCARGOPHONE — PRIVÉ
============================================================ */
$("esc-prive-call").onclick = () => {
    socket.emit("esc:prive:call", {
        target: $("esc-prive-target").value
    });
};

$("esc-prive-send").onclick = () => {
    socket.emit("esc:prive:send", {
        to: $("esc-prive-target").value,
        text: $("esc-prive-text").value
    });
    $("esc-prive-text").value = "";
};

socket.on("esc:prive:incoming", ({ from }) => {
    $("esc-prive-status").textContent = `📡 Appel entrant de ${from}`;
    socket.emit("esc:prive:accept", { from });
});

socket.on("esc:prive:calling", ({ target }) => {
    $("esc-prive-status").textContent = `📡 Appel vers ${target}...`;
});

socket.on("esc:prive:connected", ({ with: other, history }) => {
    $("esc-prive-status").textContent = `📞 Connecté avec ${other}`;
    const log = $("esc-prive-log");
    log.innerHTML = "";
    history.forEach((m) => {
        log.innerHTML += `<div><b>${m.author}</b> : ${m.text}</div>`;
    });
});

socket.on("esc:prive:message", (msg) => {
    const log = $("esc-prive-log");
    log.innerHTML += `<div><b>${msg.author}</b> : ${msg.text}</div>`;
    log.scrollTop = log.scrollHeight;
});

/* ============================================================
   MODO / ADMIN
============================================================ */
$("btn-modo-login").onclick = () => {
    socket.emit("modo:login", $("modo-code").value);
};

socket.on("modo:success", ({ grade, message }) => {
    currentGrade = grade;
    $("modo-log").innerHTML += `<div>${message}</div>`;
});

socket.on("modo:fail", ({ message }) => {
    $("modo-log").innerHTML += `<div>${message}</div>`;
});

$("btn-modo-give").onclick = () => {
    socket.emit("modo:give_berries", {
        target: $("modo-target").value,
        amount: $("modo-berries").value
    });
};

$("btn-modo-mute").onclick = () => {
    socket.emit("modo:mute", { target: $("modo-target").value });
};

$("btn-modo-unmute").onclick = () => {
    socket.emit("modo:unmute", { target: $("modo-target").value
