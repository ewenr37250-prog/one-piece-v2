const socket = io();

/* ===========================
   AUTH
=========================== */

function register() {
    const name = document.getElementById("auth-name").value;
    const pass = document.getElementById("auth-pass").value;
    const faction = document.getElementById("auth-faction").value;
    const classe = document.getElementById("auth-class").value;

    socket.emit("auth:register", { name, password: pass, faction, classe });
}

function login() {
    const name = document.getElementById("auth-name").value;
    const pass = document.getElementById("auth-pass").value;

    socket.emit("auth:login", { name, password: pass });
}

socket.on("auth:error", (msg) => {
    alert(msg);
});

socket.on("auth:success", ({ player }) => {
    document.getElementById("auth-screen").classList.add("hidden");
    document.getElementById("game-ui").classList.remove("hidden");
    updateUI(player);
});

/* ===========================
   UI UPDATE
=========================== */

function updateUI(p) {
    document.getElementById("ui-name").textContent = p.name;
    document.getElementById("ui-faction").textContent = p.faction;
    document.getElementById("ui-class").textContent = p.classe;
    document.getElementById("ui-level").textContent = p.level;
    document.getElementById("ui-xp").textContent = p.xp;
    document.getElementById("ui-berries").textContent = p.berries;
    document.getElementById("ui-bounty").textContent = p.bounty;

    applyFactionTheme(p.faction);
    updateSkillTree(p.skillTree);
}

/* ===========================
   THEMES FACTION + EMBLÈME
=========================== */

function applyFactionTheme(faction) {
    document.body.classList.remove("theme-marine", "theme-pirate", "theme-revo");

    if (faction === "marine") document.body.classList.add("theme-marine");
    if (faction === "pirate") document.body.classList.add("theme-pirate");
    if (faction === "revolutionnaire") document.body.classList.add("theme-revo");

    // Reset animation de l’emblème
    const emblem = document.getElementById("faction-emblem");
    emblem.style.animation = "none";
    void emblem.offsetWidth;
    emblem.style.animation = "emblemFadeIn 1.8s ease-out forwards";
}

/* ===========================
   TABS
=========================== */

function openTab(id, btn) {
    document.querySelectorAll(".tab").forEach(t => t.classList.add("hidden"));
    document.getElementById("tab-" + id).classList.remove("hidden");

    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
}

/* ===========================
   ACTIONS
=========================== */

function doTrain() {
    socket.emit("action:train");
}

socket.on("action:result", ({ text }) => {
    addLog(text);
});

socket.on("action:cooldown", ({ action, remaining }) => {
    addLog(`⏳ ${action} encore ${Math.ceil(remaining / 1000)}s`);
});

/* ===========================
   QUÊTES
=========================== */

function requestFactionQuest() {
    socket.emit("quest:request_faction");
}

function requestClassQuest() {
    socket.emit("quest:request_class");
}

function doFactionQuest() {
    socket.emit("action:quest_progress", { type: "faction" });
}

function doClassQuest() {
    socket.emit("action:quest_progress", { type: "class" });
}

socket.on("quest:faction_update", (q) => {
    document.getElementById("faction-quest-info").textContent =
        `${q.title} — ${q.description} (${q.progress}/${q.goal})`;
});

socket.on("quest:class_update", (q) => {
    document.getElementById("class-quest-info").textContent =
        `${q.title} — ${q.description} (${q.progress}/${q.goal})`;
});

/* ===========================
   SKILLS
=========================== */

function updateSkillTree(tree) {
    document.getElementById("skill-tp").textContent = tree.talentPoints;

    const container = document.getElementById("skill-tree-branches");
    container.innerHTML = "";

    for (const branch in tree.branches) {
        const lvl = tree.branches[branch];

        const div = document.createElement("div");
        div.className = "skill-branch";
        div.innerHTML = `
            <b>${branch}</b> : ${lvl}/${tree.maxLevel}
            <button class="btn btn-small" onclick="upgradeSkill('${branch}')">+</button>
        `;
        container.appendChild(div);
    }
}

function upgradeSkill(branch) {
    socket.emit("skill:upgrade", { branch });
}

socket.on("skill:update", (tree) => {
    updateSkillTree(tree);
});

socket.on("skill:error", (msg) => {
    addLog(msg);
});

/* ===========================
   CHAT
=========================== */

function sendChat() {
    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!text) return;

    socket.emit("chat:send", { text });
    input.value = "";
}

socket.on("chat:message", ({ author, text }) => {
    const box = document.getElementById("chat-box");
    box.innerHTML += `<div><b>${author} :</b> ${text}</div>`;
    box.scrollTop = box.scrollHeight;
});

/* ===========================
   EVENTS
=========================== */

socket.on("events:current", (ev) => {
    const box = document.getElementById("current-event");
    if (!ev) {
        box.textContent = "Aucun événement actif.";
        return;
    }
    box.textContent = `${ev.title} — ${ev.text}`;
});

socket.on("events:history", (list) => {
    const box = document.getElementById("event-history");
    box.innerHTML = "";
    list.forEach(e => {
        box.innerHTML += `<div>${e.text}</div>`;
    });
});

/* ===========================
   JOURNAL
=========================== */

function addLog(text) {
    const box = document.getElementById("log-box");
    box.innerHTML += `<div>• ${text}</div>`;
    box.scrollTop = box.scrollHeight;

    const journal = document.getElementById("journal-box");
    journal.innerHTML += `<div>${text}</div>`;
}

/* ===========================
   MODO / ADMIN
=========================== */

function askModoCode() {
    const code = prompt("Code Modo ?");
    if (code) socket.emit("modo:login", code);
}

socket.on("modo:success", () => {
    document.getElementById("modo-panel").classList.remove("hidden");
});

socket.on("modo:fail", () => {
    addLog("❌ Code modo incorrect.");
});

socket.on("modo:log", (msg) => {
    const box = document.getElementById("modo-log");
    box.innerHTML += `<div>${msg}</div>`;
    box.scrollTop = box.scrollHeight;
});

function closeModoPanel() {
    document.getElementById("modo-panel").classList.add("hidden");
}

/* ADMIN ACTIONS */

function adminSetGrade() {
    const target = document.getElementById("admin-grade-target").value;
    const grade = document.getElementById("admin-grade-value").value;
    socket.emit("admin:set_grade", { target, grade });
}

function adminCreateQuest() {
    const type = document.getElementById("admin-quest-type").value;
    const title = document.getElementById("admin-quest-title").value;
    const desc = document.getElementById("admin-quest-desc").value;
    const goal = parseInt(document.getElementById("admin-quest-goal").value);
    const rewardXP = parseInt(document.getElementById("admin-quest-reward-xp").value);
    const rewardBerries = parseInt(document.getElementById("admin-quest-reward-berries").value);
    const rewardTalent = parseInt(document.getElementById("admin-quest-reward-talent").value);

    socket.emit("admin:create_quest", {
        type, title, desc, goal, rewardXP, rewardBerries, rewardTalent
    });
}

function adminStartEvent() {
    const title = document.getElementById("admin-event-title").value;
    const desc = document.getElementById("admin-event-desc").value;
    socket.emit("admin:start_event", { title, desc });
}

function adminStopEvent() {
    socket.emit("admin:stop_event");
}

socket.on("admin:info", (msg) => {
    const box = document.getElementById("modo-log");
    box.innerHTML += `<div>${msg}</div>`;
    box.scrollTop = box.scrollHeight;
});
