// main.js

const socket = io();

let currentPlayer = null;
let currentGrade = "player";

// ---------- DOM HELPERS ----------
const $ = (id) => document.getElementById(id);
const show = (el) => el.classList.remove("hidden");
const hide = (el) => el.classList.add("hidden");

// ---------- AUTH ----------
const authError = $("auth-error");

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
    authError.textContent = msg;
});

socket.on("auth:success", ({ player }) => {
    currentPlayer = player;
    authError.textContent = "";
    hide($("auth"));
    show($("game"));
    renderPlayer();
    renderSkills();
});

// ---------- PLAYER RENDER ----------
function renderPlayer() {
    if (!currentPlayer) return;
    $("player-info").textContent =
        `${currentPlayer.name} — ${currentPlayer.faction} / ${currentPlayer.classe}`;

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

// ---------- ACTIONS ----------
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

// ---------- QUÊTES ----------
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

// ---------- SKILLS ----------
function renderSkills() {
    if (!currentPlayer) return;
    const tree = currentPlayer.skillTree;
    const container = $("skills");
    container.innerHTML = "";

    Object.entries(tree.branches).forEach(([branch, level]) => {
        const btn = document.createElement("button");
        btn.textContent = `${branch} (${level}/${tree.maxLevel})`;
        btn.onclick = () => {
            socket.emit("skill:upgrade", { branch });
        };
        container.appendChild(btn);
    });
}

socket.on("skill:update", (tree) => {
    if (!currentPlayer) return;
    currentPlayer.skillTree = tree;
    renderPlayer();
    renderSkills();
});

socket.on("skill:error", (msg) => {
    $("action-result").textContent = msg;
});

// ---------- EVENTS ----------
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

// ---------- ESCARGOPHONE FACTION ----------
$("esc-faction-send").onclick = () => {
    const text = $("esc-faction-text").value;
    $("esc-faction-text").value = "";
    socket.emit("esc:faction:send", { text });
};

socket.on("esc:faction:message", (msg) => {
    const log = $("esc-faction-log");
    log.innerHTML += `<div><b>${msg.author}</b> : ${msg.text}</div>`;
    log.scrollTop = log.scrollHeight;
});

// ---------- ESCARGOPHONE HRP ----------
$("esc-hrp-send").onclick = () => {
    const text = $("esc-hrp-text").value;
    $("esc-hrp-text").value = "";
    socket.emit("esc:hrp:send", { text });
};

socket.on("esc:hrp:message", (msg) => {
    const log = $("esc-hrp-log");
    log.innerHTML += `<div><b>${msg.author}</b> : ${msg.text}</div>`;
    log.scrollTop = log.scrollHeight;
});

// ---------- ESCARGOPHONE PRIVÉ ----------
$("esc-prive-call").onclick = () => {
    const target = $("esc-prive-target").value;
    socket.emit("esc:prive:call", { target });
};

$("esc-prive-send").onclick = () => {
    const text = $("esc-prive-text").value;
    const target = $("esc-prive-target").value;
    $("esc-prive-text").value = "";
    socket.emit("esc:prive:send", { to: target, text });
};

socket.on("esc:prive:incoming", ({ from }) => {
    $("esc-prive-status").textContent = `📡 Appel entrant de ${from}`;
    // auto-accept pour simplifier
    socket.emit("esc:prive:accept", { from });
});

socket.on("esc:prive:calling", ({ target }) => {
    $("esc-prive-status").textContent = `📡 Appel vers ${target}...`;
});

socket.on("esc:prive:connected", ({ with: other, history }) => {
    $("esc-prive-status").textContent = `✅ Connecté avec ${other}`;
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

// ---------- MODO / ADMIN ----------
$("btn-modo-login").onclick = () => {
    const code = $("modo-code").value;
    socket.emit("modo:login", code);
};

socket.on("modo:success", ({ grade, message }) => {
    currentGrade = grade;
    $("grade-info").textContent = `Grade : ${grade}`;
    appendModoLog(message);
});

socket.on("modo:fail", ({ message }) => {
    appendModoLog(message || "Code refusé.");
});

socket.on("modo:log", (text) => appendModoLog(text));
socket.on("admin:info", (text) => appendAdminLog(text));
socket.on("admin:grade_update", ({ grade }) => {
    currentGrade = grade;
    $("grade-info").textContent = `Grade : ${grade}`;
});

function appendModoLog(text) {
    $("modo-log").innerHTML += `<div>${text}</div>`;
}

function appendAdminLog(text) {
    $("admin-log").innerHTML += `<div>${text}</div>`;
}

// Modo actions
$("btn-modo-give").onclick = () => {
    socket.emit("modo:give_berries", {
        target: $("modo-target").value,
        amount: Number($("modo-berries").value)
    });
};

$("btn-modo-mute").onclick = () => {
    socket.emit("modo:mute", { target: $("modo-target").value });
};

$("btn-modo-unmute").onclick = () => {
    socket.emit("modo:unmute", { target: $("modo-target").value });
};

$("btn-modo-kick").onclick = () => {
    socket.emit("modo:kick", { target: $("modo-target").value });
};

$("btn-modo-announce").onclick = () => {
    socket.emit("modo:announce", {
        text: $("modo-announce-text").value
    });
    $("modo-announce-text").value = "";
};

// Admin actions
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
