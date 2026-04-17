const socket = io();
let currentPlayer = null;
let cooldownTimers = {};

/* THEME DYNAMIQUE PAR CLASSE */
function applyThemeForClass(classe) {
    const cls = classe.replace(/ /g, "-");
    document.body.className = "theme-" + cls;
}

/* AUTH */

function register() {
    const name = document.getElementById("auth-name").value.trim();
    const pass = document.getElementById("auth-pass").value.trim();
    const faction = document.getElementById("auth-faction").value;
    const classe = document.getElementById("auth-class").value;
    socket.emit('auth:register', { name, password: pass, faction, classe });
}

function login() {
    const name = document.getElementById("auth-name").value.trim();
    const pass = document.getElementById("auth-pass").value.trim();
    socket.emit('auth:login', { name, password: pass });
}

socket.on('auth:success', ({ player }) => {
    currentPlayer = player;
    document.getElementById("auth-screen").classList.add('hidden');
    document.getElementById("game-ui").classList.remove('hidden');
    updateUI(player);
    renderSkillTree(player.skillTree);
});

socket.on('auth:error', (msg) => alert(msg));

/* UI */

function updateUI(p) {
    document.getElementById("ui-name").innerText = p.name;
    document.getElementById("ui-faction").innerText = p.faction;
    document.getElementById("ui-class").innerText = p.classe;
    document.getElementById("ui-level").innerText = p.level;
    document.getElementById("ui-xp").innerText = p.xp;
    document.getElementById("ui-berries").innerText = p.berries;
    document.getElementById("ui-bounty").innerText = p.bounty || 0;
    document.getElementById("skill-tp").innerText = p.skillTree.talentPoints;

    currentPlayer = p;
    renderSkillTree(p.skillTree);
    renderQuests(p);
    applyThemeForClass(p.classe);
}

socket.on('player:update', (p) => updateUI(p));

/* LOG */

function addLog(text) {
    const box = document.getElementById("log-box");
    const div = document.createElement('div');
    div.className = "log-entry";
    div.innerText = text;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

/* ACTIONS */

function doTrain() {
    socket.emit('action:train');
}

function doFactionQuest() {
    socket.emit('action:quest_progress', { type: "faction" });
}

function doClassQuest() {
    socket.emit('action:quest_progress', { type: "class" });
}

socket.on('action:result', (d) => addLog(d.text));

socket.on('action:cooldown', ({ action, remaining }) => {
    const btnId = action === "train" ? "btn-train" : null;
    if (!btnId) return;
    const btn = document.getElementById(btnId);
    if (!btn) return;

    if (cooldownTimers[action]) clearInterval(cooldownTimers[action]);
    let sec = Math.ceil(remaining / 1000);
    const base = btn.innerText;
    btn.disabled = true;

    cooldownTimers[action] = setInterval(() => {
        btn.innerText = `${base} (${sec}s)`;
        sec--;
        if (sec <= 0) {
            clearInterval(cooldownTimers[action]);
            btn.disabled = false;
            btn.innerText = base;
        }
    }, 1000);
});

/* QUÊTES */

function requestFactionQuest() {
    socket.emit('quest:request_faction');
}

function requestClassQuest() {
    socket.emit('quest:request_class');
}

socket.on('quest:faction_update', (q) => {
    document.getElementById("faction-quest-info").innerText =
        `${q.title} — ${q.progress}/${q.goal} (Récompense: ${q.rewardBerries} ฿, ${q.rewardXP} XP)`;
});

socket.on('quest:class_update', (q) => {
    document.getElementById("class-quest-info").innerText =
        `${q.title} — ${q.progress}/${q.goal} (Récompense: ${q.rewardXP} XP, ${q.rewardTalent} PT)`;
});

function renderQuests(p) {
    const fq = p.factionQuest;
    const cq = p.classQuest;
    document.getElementById("faction-quest-info").innerText =
        fq ? `${fq.title} — ${fq.progress}/${fq.goal}` : "Aucune quête active.";
    document.getElementById("class-quest-info").innerText =
        cq ? `${cq.title} — ${cq.progress}/${cq.goal}` : "Aucune quête active.";
}

/* SKILLS */

function renderSkillTree(tree) {
    const container = document.getElementById("skill-tree-branches");
    container.innerHTML = "";
    if (!tree || !tree.branches) return;
    Object.keys(tree.branches).forEach(branch => {
        const lvl = tree.branches[branch];
        const row = document.createElement('div');
        const label = document.createElement('span');
        label.innerText = `${branch} : ${lvl}/${tree.maxLevel}`;
        const btn = document.createElement('button');
        btn.className = "btn btn-small";
        btn.innerText = "+";
        btn.onclick = () => upgradeSkill(branch);
        row.appendChild(label);
        row.appendChild(btn);
        container.appendChild(row);
    });
}

function upgradeSkill(branch) {
    socket.emit('skill:upgrade', { branch });
}

socket.on('skill:update', (tree) => {
    currentPlayer.skillTree = tree;
    renderSkillTree(tree);
    document.getElementById("skill-tp").innerText = tree.talentPoints;
});

socket.on('skill:error', (msg) => alert(msg));

/* CHAT */

function sendChat() {
    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!text) return;
    socket.emit('chat:send', { text });
    input.value = "";
}

socket.on('chat:message', (m) => {
    const box = document.getElementById("chat-box");
    const div = document.createElement('div');
    div.className = "msg";
    div.innerHTML = `<b>${m.author}:</b> ${m.text}`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
});

/* JOURNAL */

socket.on('journal:entry', (e) => {
    const box = document.getElementById("journal-box");
    const div = document.createElement('div');
    div.className = "log-entry";
    div.innerText = e.text;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
});

/* EVENTS */

socket.on('events:history', (list) => {
    const box = document.getElementById("event-history");
    box.innerHTML = "";
    list.forEach(ev => {
        const div = document.createElement('div');
        div.className = "log-entry";
        div.innerText = ev.text;
        box.appendChild(div);
    });
    box.scrollTop = box.scrollHeight;
});

socket.on('events:current', (ev) => {
    document.getElementById("current-event").innerText =
        ev ? ev.text : "Aucun événement actif.";
});

/* MODO */

function askModoCode() {
    const code = prompt("Code Modo :");
    if (!code) return;
    socket.emit('modo:login', code);
}

socket.on('modo:success', () => {
    document.getElementById("modo-panel").classList.remove('hidden');
});

socket.on('modo:fail', () => alert("Code incorrect."));

socket.on('modo:log', (txt) => {
    const box = document.getElementById("modo-log");
    const div = document.createElement('div');
    div.innerText = txt;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
});

function closeModoPanel() {
    document.getElementById("modo-panel").classList.add('hidden');
}

function modoGiveBerries() {
    const target = document.getElementById("modo-target").value.trim();
    const amount = parseInt(document.getElementById("modo-amount").value);
    if (!target || isNaN(amount)) return;
    socket.emit('modo:give_berries', { target, amount });
}

function modoKick() {
    const target = document.getElementById("modo-kick-target").value.trim();
    if (!target) return;
    socket.emit('modo:kick', { target });
}

/* TABS */

function openTab(name, btn) {
    document.querySelectorAll('.tab').forEach(t => t.classList.add('hidden'));
    document.getElementById('tab-' + name).classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
}
