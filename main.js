/* ============================================================
   MAIN.JS — INTERFACE RP ONE PIECE
   Compatible avec ton nouvel index.html
   ============================================================ */


/* ============================================================
   HELPERS
   ============================================================ */
const $  = (sel, scope = document) => scope.querySelector(sel);
const $$ = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));

function logRP(...args) {
    console.log("[ONE PIECE RP]", ...args);
}


/* ============================================================
   SECTION 1 — GESTION DES THÈMES (Faction + Grade)
   ============================================================ */

/**
 * Supprime toutes les classes theme-* du body
 */
function clearAllThemes() {
    document.body.className = document.body.className
        .split(" ")
        .filter(c => !c.startsWith("theme-"))
        .join(" ")
        .trim();
}

/**
 * Applique un thème complet :
 * - theme-faction
 * - theme-faction-grade-grade
 */
function applyTheme(faction, grade) {
    clearAllThemes();

    // Classe de base (couleurs, ambiance)
    document.body.classList.add(`theme-${faction}`);

    // Classe de grade (fond évolutif)
    if (grade) {
        document.body.classList.add(`theme-${faction}-grade-${grade}`);
    }

    logRP(`Thème appliqué : faction=${faction}, grade=${grade}`);
}

/**
 * Récupère les valeurs des selects et applique le thème
 */
function handleApplyTheme() {
    const faction = $("#select-faction").value;
    const grade   = $("#select-grade").value;

    applyTheme(faction, grade);

    // Micro animation RP
    const btn = $("#apply-theme");
    btn.classList.add("micro-impact");
    setTimeout(() => btn.classList.remove("micro-impact"), 150);
}


/* ============================================================
   SECTION 2 — ONGLET NAVIGATION
   ============================================================ */

function showTab(tabName) {
    // Cacher tous les contenus
    $$(".tab-content").forEach(tab => {
        tab.style.display = "none";
    });

    // Désactiver tous les onglets
    $$(".tab").forEach(t => t.classList.remove("active"));

    // Activer l’onglet cliqué
    const activeTab = $(`.tab[data-tab="${tabName}"]`);
    if (activeTab) activeTab.classList.add("active");

    // Afficher le contenu correspondant
    const content = $(`#${tabName}`);
    if (content) {
        content.style.display = "block";
        content.classList.add("fade-in");
        setTimeout(() => content.classList.remove("fade-in"), 400);
    }

    logRP("Onglet ouvert :", tabName);
}

function initTabs() {
    $$(".tab").forEach(tab => {
        tab.addEventListener("click", () => {
            showTab(tab.dataset.tab);
        });
    });

    // Onglet par défaut
    showTab("profil");
}


/* ============================================================
   SECTION 3 — CHAT RP
   ============================================================ */

function addChatMessage(author, text) {
    const box = $("#chat-box");
    if (!box) return;

    const msg = document.createElement("div");
    msg.className = "message";

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.style.backgroundImage = "url('assets/portraits/default.jpg')";

    const content = document.createElement("div");
    content.className = "message-content";

    const authorEl = document.createElement("div");
    authorEl.className = "message-author";
    authorEl.textContent = author;

    const textEl = document.createElement("div");
    textEl.className = "message-text";
    textEl.textContent = text;

    content.appendChild(authorEl);
    content.appendChild(textEl);

    msg.appendChild(avatar);
    msg.appendChild(content);

    box.appendChild(msg);
    box.scrollTop = box.scrollHeight;
}

function sendChatMessage() {
    const input = $("#chat-input");
    const text = input.value.trim();
    if (!text) return;

    addChatMessage("Vous", text);
    input.value = "";
}

function initChat() {
    $("#send-message").addEventListener("click", sendChatMessage);

    $("#chat-input").addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            sendChatMessage();
        }
    });

    // Message d’accueil
    addChatMessage("Système", "Bienvenue dans le chat RP.");
}


/* ============================================================
   SECTION 4 — INITIALISATION GLOBALE
   ============================================================ */

function initRP() {
    initTabs();
    initChat();

    $("#apply-theme").addEventListener("click", handleApplyTheme);

    logRP("Interface RP initialisée.");
}

document.addEventListener("DOMContentLoaded", initRP);
