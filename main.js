/* ============================================================
   CONFIGURATION & CONSTANTES
============================================================ */
const socket = io();
let currentPlayer = null;
let currentGrade = "player"; // Sera mis à jour par l'admin.js

const $ = (id) => document.getElementById(id);
const show = (el) => { if(el) el.classList.remove("hidden"); };
const hide = (el) => { if(el) el.classList.add("hidden"); };
const formatN = (num) => new Intl.NumberFormat('fr-FR').format(num);

/* ============================================================
   AUTHENTIFICATION
============================================================ */
$("tab-login").onclick = () => {
    $("tab-login").classList.add("active"); $("tab-register").classList.remove("active");
    show($("login-panel")); hide($("register-panel"));
};

$("tab-register").onclick = () => {
    $("tab-register").classList.add("active"); $("tab-login").classList.remove("active");
    show($("register-panel")); hide($("login-panel"));
};

$("btn-register").onclick = () => {
    socket.emit("auth:register", {
        name: $("reg-name").value, password: $("reg-pass").value,
        faction: $("reg-faction").value, classe: $("reg-classe").value
    });
};

$("btn-login").onclick = () => {
    socket.emit("auth:login", { name: $("log-name").value, password: $("log-pass").value });
};

socket.on("auth:error", (msg) => { $("auth-error").textContent = msg; });
socket.on("auth:success", ({ player }) => {
    currentPlayer = player;
    $("auth-error").textContent = "";
    hide($("auth")); show($("game"));
    applyFactionTheme(player.faction);
    renderPlayer(); renderSkills();
});

function applyFactionTheme(faction) {
    if (!faction) return;
    const f = faction.toLowerCase();
    if (f.includes("marine")) document.body.className = "theme-marine";
    else if (f.includes("pirate")) document.body.className = "theme-pirate";
    else if (f.includes("revo")) document.body.className = "theme-revo";
}

/* ============================================================
   NAVIGATION (ONGLETS PARCHEMIN)
============================================================ */
const navButtons = document.querySelectorAll('.menu-tabs button, .nav-item');

navButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const targetId = e.target.getAttribute('data-target');
        if (!targetId) return;

        document.querySelectorAll('.parchment-view').forEach(view => {
            view.classList.remove('active'); view.classList.add('hidden');
        });

        const targetView = document.getElementById(targetId);
        if (targetView) {
            targetView.classList.remove('hidden'); targetView.classList.add('active');
        }
        
        navButtons.forEach(b => b.style.color = "var(--text-color)");
        e.target.style.color = "var(--gold)";
    });
});

/* ============================================================
   RENDU JOUEUR & SKILLS
============================================================ */
function renderPlayer() {
    if (!currentPlayer) return;

    $("player-name").innerText = currentPlayer.name;
    $("player-level").innerText = `Niveau ${currentPlayer.level}`;

    const maxHP = currentPlayer.hpMax || 1250;
    const currentHP = currentPlayer.hp || maxHP;
    $("hp-text").innerText = `HP ${currentHP}/${maxHP}`;
    $("hp-fill").style.width = `${(currentHP / maxHP) * 100}%`;

    const xpNext = currentPlayer.xpNext || 7200;
    $("xp-text").innerText = `XP ${currentPlayer.xp}/${xpNext}`;
    $("xp-fill").style.width = `${(currentPlayer.xp / xpNext) * 100}%`;

    $("stat-berries").innerHTML = `Berries: <span class="gold">${formatN(currentPlayer.berries)} ฿</span>`;
    $("stat-talent").innerHTML = `Points de talent: ${currentPlayer.skillTree.talentPoints}`;
    $("bounty-value").innerText = `${formatN(currentPlayer.bounty)} ฿`;
    $("stat-reputation").innerText = `Réputation: ${currentPlayer.reputation || 0}`;
}

function renderSkills() {
    if (!currentPlayer || !currentPlayer.skillTree) return;
    const tree = currentPlayer.skillTree;
    const container = $("skills");
    container.innerHTML = "";

    Object.entries(tree.branches).forEach(([branch, level]) => {
        const btn = document.createElement("button");
        btn.className = "btn-action";
        btn.textContent = `${branch} (Niv. ${level}/${tree.maxLevel})`;
        btn.onclick = () => socket.emit("skill:upgrade", { branch });
        container.appendChild(btn);
    });
}

socket.on("player:update", (player) => {
    currentPlayer = player; renderPlayer(); renderSkills();
});

/* ============================================================
   ACTIONS RAPIDES & QUÊTES
============================================================ */
$("btn-train").onclick = () => socket.emit("action:train");
$("btn-work").onclick = () => socket.emit("action:work");
$("btn-combat").onclick = () => socket.emit("action:combat");
$("btn-explore").onclick = () => socket.emit("action:explore");
$("btn-fish").onclick = () => socket.emit("action:fish");
$("btn-blackmarket").onclick = () => socket.emit("action:blackmarket");

socket.on("action:result", ({ text }) => {
    const res = $("action-result");
    res.textContent = text;
    res.style.animation = 'none'; res.offsetHeight; // Reset animation
    res.style.animation = 'fadeInOut 2s forwards';
});

function updateQuestUI(q, type) {
    const container = $("quest-info");
    const questId = `quest-${type}`;
    let questBox = $(questId);

    if (!questBox) {
        questBox = document.createElement("div"); questBox.id = questId;
        questBox.className = "quest-box"; container.appendChild(questBox);
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
   CHAT MONDE & EVENTS
============================================================ */
function sendMessage() {
    const text = $("chat-text").value.trim();
    if (!text) return;
    socket.emit("chat:send", { text });
    $("chat-text").value = "";
}

$("chat-send").onclick = sendMessage;
$("chat-text").onkeypress = (e) => { if (e.key === "Enter") sendMessage(); };

socket.on("chat:message", ({ author, text }) => {
    const log = $("chat-messages");
    const line = document.createElement("div");
    line.className = "chat-line";
    line.innerHTML = `<strong style="color:var(--gold)">${author}</strong>: ${text}`;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
});

socket.on("events:current", (ev) => {
    $("event-current").textContent = ev ? `🔥 ${ev.title} : ${ev.text}` : "Aucun événement en cours.";
});
