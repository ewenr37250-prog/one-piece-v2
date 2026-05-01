/* ============================================================
   LOGIQUE D'ADMINISTRATION (Le Chevreuil)
============================================================ */

// Gestion Modal
$("btn-open-admin").onclick = () => show($("admin-modal"));
$("btn-close-admin").onclick = () => hide($("admin-modal"));

/* ============================================================
   CONNEXION
============================================================ */
$("btn-modo-login").onclick = () => {
    socket.emit("modo:login", $("modo-code").value);
};

socket.on("modo:success", () => {
    currentGrade = "modo"; // ou Admin selon ton serveur
    $("grade-info").textContent = `Grade : ${currentGrade} (Accès Autorisé)`;
    $("grade-info").style.color = "#4caf50";
    
    hide($("admin-login-section"));
    show($("admin-tools-section"));
    appendModoLog("Connexion sécurisée établie.");
});

socket.on("modo:fail", () => appendModoLog("Erreur : Code refusé."));

/* ============================================================
   LOGS
============================================================ */
socket.on("modo:log", (text) => appendModoLog(text));
socket.on("admin:info", (text) => appendAdminLog(text));

function appendModoLog(text) {
    const log = $("modo-log");
    const line = document.createElement("div"); line.textContent = `> ${text}`;
    log.appendChild(line); log.scrollTop = log.scrollHeight;
}

function appendAdminLog(text) {
    const log = $("admin-log");
    const line = document.createElement("div"); line.textContent = `> ${text}`;
    log.appendChild(line); log.scrollTop = log.scrollHeight;
}

/* ============================================================
   ACTIONS
============================================================ */
$("btn-modo-give").onclick = () => {
    socket.emit("modo:give_berries", {
        target: $("modo-target").value,
        amount: Number($("modo-berries").value)
    });
};

$("btn-modo-kick").onclick = () => socket.emit("modo:kick", { target: $("modo-target").value });

$("btn-admin-set-grade").onclick = () => {
    socket.emit("admin:set_grade", {
        target: $("admin-target").value, grade: $("admin-grade").value
    });
};

$("btn-admin-reset").onclick = () => {
    if(confirm("Es-tu sûr de vouloir RESET ce joueur ? Cette action est irréversible !")) {
        socket.emit("admin:reset_player", { target: $("admin-reset-target").value });
    }
};

/* ============================================================
   CRÉATEUR (QUÊTES & EVENTS)
============================================================ */
$("btn-admin-qf").onclick = () => {
    socket.emit("admin:create_quest", {
        type: "faction", title: $("qf-title").value, desc: $("qf-desc").value,
        goal: Number($("qf-goal").value), rewardXP: Number($("qf-rxp").value), rewardBerries: Number($("qf-rb").value)
    });
};

$("btn-admin-qc").onclick = () => {
    socket.emit("admin:create_quest", {
        type: "class", title: $("qc-title").value, desc: $("qc-desc").value,
        goal: Number($("qc-goal").value), rewardXP: Number($("qc-rxp").value), rewardTalent: Number($("qc-rt").value)
    });
};

$("btn-admin-start-event").onclick = () => {
    socket.emit("admin:start_event", { title: $("ev-title").value, desc: $("ev-desc").value });
};

$("btn-admin-stop-event").onclick = () => socket.emit("admin:stop_event");
