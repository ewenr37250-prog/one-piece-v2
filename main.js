/* ============================================================
   CONFIGURATION & CONSTANTES
============================================================ */
const socket = io();
let currentPlayer = null;
let currentGrade = "player";

// Helpers pour gagner du temps
const $ = (id) => document.getElementById(id);
const show = (el) => el.classList.remove("hidden");
const hide = (el) => el.classList.add("hidden");

// Formateur de nombres (ex: 1 250 000 ฿)
const formatN = (num) => new Intl.NumberFormat('fr-FR').format(num);

/* ============================================================
   AUTHENTIFICATION & TABS
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
   THEMES & VISUELS
============================================================ */
function applyFactionTheme(faction) {
    const body = document.body;
    if (!faction) return;
    const f = faction.toLowerCase();
    if (f.includes("marine")) body.className = "theme-marine";
    else if (f.includes("pirate")) body.className = "theme-pirate";
    else if (f.includes("revo")) body.className = "theme-revo";
}

/* ============================================================
   RENDU DU JOUEUR (L'INTERFACE GRAPHIQUE)
============================================================ */
function renderPlayer() {
    if (!currentPlayer) return;

    // Identité
    $("player-name").innerText = currentPlayer.name;
    $("player-level").innerText = `Niveau ${currentPlayer.level}`;

    // Barres de Progression
    const maxHP = currentPlayer.hpMax || 1250;
    const currentHP = currentPlayer.hp || maxHP;
    $("hp-text").innerText = `HP ${currentHP}/${maxHP}`;
    $("hp-fill").style.width = `${(currentHP / maxHP) * 100}%`;

    const xpNext = currentPlayer.xpNext || 7200;
    $("xp-text").innerText = `XP ${currentPlayer.xp}/${xpNext}`;
    $("xp-fill").style.width = `${(currentPlayer.xp / xpNext) * 100}%`;

    // Économie & Stats
    $("stat-berries").innerHTML = `Berries: <span class="gold">${formatN(currentPlayer.berries)} ฿</span>`;
    $("stat-talent").innerHTML = `Points de talent: ${currentPlayer.skillTree.talentPoints}`;
    $("bounty-value").innerText = `${formatN(currentPlayer.bounty)} ฿`;
    
    // Réputation (exemple de gestion dynamique)
    const repEl = $("stat-reputation");
    repEl.innerText = `Réputation: ${currentPlayer.reputation || 0} (Respecté)`;
}

socket.on("player:update", (player) => {
    currentPlayer = player;
    renderPlayer();
    renderSkills();
});

/* ============================================================
   ACTIONS & QUÊTES
============================================================ */
$("btn-train").onclick = () => {
    socket.emit("action:train");
};

socket.on("action:result", ({ text }) => {
    $("action-result").textContent = text;
    // Disparaît après 3 secondes pour garder le parchemin propre
    setTimeout(() => { $("action-result").textContent = ""; }, 3000);
});

socket.on("action:cooldown", ({ remaining }) => {
    $("action-result").textContent = `Attends encore ${Math.ceil(remaining / 1000)}s...`;
});

// Gestion des Quêtes (Rendu en liste)
function updateQuestUI(q, type) {
    const container = $("quest-info");
    const questId = `quest-${type}`;
    let questBox = $(questId);

    if (!questBox) {
        questBox = document.createElement("div");
        questBox.id = questId;
        questBox.className = "quest-box";
        container.appendChild(questBox);
    }

    const progressPercent = q.goal > 0 ? (q.progress / q.goal) * 100 : 0;

    questBox.innerHTML = `
        <p>${type === 'faction' ? '🚩' : '⚔️'} ${q.title}</p>
        <div class="mini-progress"><div class="fill" style="width: ${progressPercent}%"></div></div>
        <small>${q.goal - (q.progress || 0)} restant(s)</small>
    `;
}

socket.on("quest:faction_update", (q) => updateQuestUI(q, 'faction'));
socket.on("quest:class_update", (q) => updateQuestUI(q, 'class'));

/* ============================================================
   CHAT MONDE
============================================================ */
$("chat-send").onclick = sendMessage;
$("chat-text").onkeypress = (e) => { if (e.key === "Enter") sendMessage(); };

function sendMessage() {
    const text = $("chat-text").value.trim();
    if (!text) return;
    socket.emit("chat:send", { text });
    $("chat-text").value = "";
}

socket.on("chat:message", ({ author, text }) => {
    const log = $("chat-messages");
    const line = document.createElement("div");
    line.className = "chat-line";
    line.innerHTML = `<span class="chat-author">${author}</span> : ${text}`;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
});

/* ============================================================
   SKILLS & EVENTS
============================================================ */
function renderSkills() {
    if (!currentPlayer) return;
    const tree = currentPlayer.skillTree;
    const container = $("skills");
    container.innerHTML = "<p class='section-title'>COMPÉTENCES</p>";

    Object.entries(tree.branches).forEach(([branch, level]) => {
        const btn = document.createElement("button");
        btn.className = "btn-action";
        btn.textContent = `${branch} (Niv. ${level}/${tree.maxLevel})`;
        btn.onclick = () => socket.emit("skill:upgrade", { branch });
        container.appendChild(btn);
    });
}

socket.on("events:current", (ev) => {
    const tag = $("event-current");
    tag.textContent = ev ? `🔥 ${ev.title} : ${ev.text}` : "Aucun événement en cours.";
});
