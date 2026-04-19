/* ============================================================
   MAIN.JS — SECTION 1
   INITIALISATION & GESTION DU THÈME ACTIF
   ------------------------------------------------------------
   Objectif :
   - Charger le thème sauvegardé (Marine / Pirate / Révo / Login)
   - L’appliquer au <body>
   - Préparer des helpers pour la suite (onglets, modo, etc.)
   ============================================================ */


/* ============================================================
   HELPERS DE BASE
   ------------------------------------------------------------
   $  : sélectionne un seul élément
   $$ : sélectionne plusieurs éléments
   logRP : petit log stylé pour debug RP
   ============================================================ */
const $  = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

const logRP = (...args) => {
    console.log("[ONE PIECE RP]", ...args);
};


/* ============================================================
   GESTION DU THÈME ACTIF
   ------------------------------------------------------------
   - Le thème est stocké dans localStorage sous la clé "rp-theme"
   - Valeurs possibles : "theme-login", "theme-marine",
                         "theme-pirate", "theme-revo"
   - Le thème est appliqué comme classe sur <body>
   ============================================================ */

const THEME_KEY = "rp-theme";

/**
 * Retourne le thème sauvegardé dans localStorage,
 * ou null si aucun thème n’est encore défini.
 */
function getSavedTheme() {
    try {
        return localStorage.getItem(THEME_KEY);
    } catch (e) {
        logRP("Impossible de lire localStorage (mode privé ?)", e);
        return null;
    }
}

/**
 * Sauvegarde le thème dans localStorage.
 * @param {string} themeClass - ex : "theme-marine"
 */
function saveTheme(themeClass) {
    try {
        localStorage.setItem(THEME_KEY, themeClass);
    } catch (e) {
        logRP("Impossible d’écrire dans localStorage", e);
    }
}

/**
 * Applique un thème au <body>.
 * - Supprime les anciens thèmes
 * - Ajoute la nouvelle classe
 * - Sauvegarde le choix
 */
function applyTheme(themeClass) {
    const body = document.body;
    const themeClasses = ["theme-login", "theme-marine", "theme-pirate", "theme-revo"];

    body.classList.remove(...themeClasses);
    body.classList.add(themeClass);

    saveTheme(themeClass);
    logRP("Thème appliqué :", themeClass);
}


/* ============================================================
   INITIALISATION GLOBALE
   ------------------------------------------------------------
   - Appelée au chargement de la page
   - Récupère le thème sauvegardé
   - Si aucun thème → theme-login par défaut
   ============================================================ */

function initRPInterface() {
    const savedTheme = getSavedTheme();

    if (savedTheme && ["theme-login", "theme-marine", "theme-pirate", "theme-revo"].includes(savedTheme)) {
        applyTheme(savedTheme);
    } else {
        // Thème par défaut : page de login / carte du monde
        applyTheme("theme-login");
    }

    logRP("Interface RP initialisée.");
}


/* ============================================================
   LANCEMENT AU CHARGEMENT DU DOM
   ------------------------------------------------------------
   - On attend que le DOM soit prêt
   - Puis on initialise l’interface RP
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
    initRPInterface();
});
/* ============================================================
   MAIN.JS — SECTION 2
   SYSTÈME D’ONGLETS RP ONE PIECE
   ------------------------------------------------------------
   Objectif :
   - Gérer les clics sur les onglets
   - Activer / désactiver les boutons
   - Afficher le contenu correspondant
   - Ajouter une petite animation RP
   ============================================================ */


/**
 * Active un onglet donné.
 * @param {string} tabName - ex : "profil", "quetes", "skills"
 */
function openTab(tabName) {

    // 1. Désactiver tous les onglets
    $$(".tab-btn").forEach(btn => btn.classList.remove("active"));

    // 2. Cacher tous les contenus
    $$(".tab").forEach(tab => tab.classList.add("hidden"));

    // 3. Activer le bouton correspondant
    const activeBtn = $(`.tab-btn[data-tab="${tabName}"]`);
    if (activeBtn) activeBtn.classList.add("active");

    // 4. Afficher le contenu correspondant
    const activeTab = $(`#tab-${tabName}`);
    if (activeTab) {
        activeTab.classList.remove("hidden");

        // Petite animation RP (fade-in léger)
        activeTab.style.opacity = 0;
        setTimeout(() => {
            activeTab.style.transition = "opacity 0.25s ease";
            activeTab.style.opacity = 1;
        }, 10);
    }

    // 5. Scroll vers le haut (propre)
    window.scrollTo({ top: 0, behavior: "smooth" });

    logRP("Onglet ouvert :", tabName);
}



/* ============================================================
   INITIALISATION DES ONGLETS
   ------------------------------------------------------------
   - Ajoute les listeners sur tous les boutons d’onglets
   - Active l’onglet par défaut (profil ou autre)
   ============================================================ */

function initTabs() {

    // Ajouter les listeners
    $$(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const tabName = btn.dataset.tab;
            openTab(tabName);
        });
    });

    // Déterminer l’onglet par défaut
    const defaultTab = "profil"; // tu peux changer ici

    openTab(defaultTab);

    logRP("Système d’onglets initialisé.");
}
/* ============================================================
   MAIN.JS — SECTION 3
   SYSTÈME DE THÈMES (Marine / Pirate / Révo / Login)
   ------------------------------------------------------------
   Objectif :
   - Permettre de changer de thème en un clic
   - Appliquer la classe correspondante au <body>
   - Sauvegarder le thème dans localStorage
   - Mettre à jour automatiquement l’emblème watermark
   ============================================================ */


/**
 * Change le thème actif.
 * @param {string} themeName - ex : "marine", "pirate", "revo", "login"
 */
function setTheme(themeName) {
    const themeClass = `theme-${themeName}`;

    applyTheme(themeClass); // ← vient de la SECTION 1

    updateEmblem(); // ← watermark dynamique

    logRP("Thème changé :", themeClass);
}



/* ============================================================
   MISE À JOUR DU WATERMARK
   ------------------------------------------------------------
   Objectif :
   - Forcer le rafraîchissement de l’emblème
   - (le CSS gère l’image selon la classe du body)
   ============================================================ */
function updateEmblem() {
    const emblem = $("#faction-emblem");
    if (!emblem) return;

    // Petite astuce : on force un "reflow" pour relancer l’animation
    emblem.style.animation = "none";
    void emblem.offsetWidth; // reset
    emblem.style.animation = "";
}



/* ============================================================
   INITIALISATION DES BOUTONS DE THÈME
   ------------------------------------------------------------
   - Tous les boutons doivent avoir data-theme="marine" etc.
   - Exemple HTML :
       <button class="btn-theme" data-theme="pirate">Pirate</button>
   ============================================================ */
function initThemeButtons() {
    $$(".btn-theme").forEach(btn => {
        btn.addEventListener("click", () => {
            const theme = btn.dataset.theme;
            setTheme(theme);
        });
    });

    logRP("Boutons de thème initialisés.");
}
/* ============================================================
   MAIN.JS — SECTION 4
   PANEL MODO (PANTHÉON)
   ------------------------------------------------------------
   Objectif :
   - Gérer l’ouverture du panel modo
   - Vérifier le code modo
   - Afficher / cacher la fenêtre modale
   - Préparer les hooks pour les actions modo
   ============================================================ */


/* ============================================================
   CODE MODO (à synchroniser avec ton server.js)
   ------------------------------------------------------------
   IMPORTANT :
   - Ce code n’est PAS une sécurité réelle
   - C’est juste un accès client RP
   - La vraie sécurité doit être côté serveur
   ============================================================ */
const MODO_CODE = "PANTHEON_OP"; // même que dans server.js



/* ============================================================
   OUVERTURE DU PANEL MODO
   ------------------------------------------------------------
   - Demande un code via prompt RP
   - Vérifie le code
   - Affiche la fenêtre modale
   ============================================================ */
function openModoPanel() {

    const userCode = prompt("🔱 Entrez le code du Panthéon :");

    if (!userCode) {
        logRP("Accès modo annulé.");
        return;
    }

    if (userCode !== MODO_CODE) {
        alert("❌ Code incorrect. L’accès au Panthéon est refusé.");
        logRP("Tentative d’accès modo refusée.");
        return;
    }

    // Code correct → on ouvre le panel
    const panel = $("#panel-modo");
    if (!panel) return;

    panel.classList.remove("hidden");

    // Animation RP (reset)
    panel.style.animation = "none";
    void panel.offsetWidth;
    panel.style.animation = "";

    logRP("Accès modo accordé.");
}



/* ============================================================
   FERMETURE DU PANEL MODO
   ------------------------------------------------------------
   - Cache la fenêtre modale
   ============================================================ */
function closeModoPanel() {
    const panel = $("#panel-modo");
    if (!panel) return;

    panel.classList.add("hidden");
    logRP("Panel modo fermé.");
}



/* ============================================================
   INITIALISATION DES BOUTONS MODO
   ------------------------------------------------------------
   - Bouton d’ouverture : .btn-open-modo
   - Bouton de fermeture : .btn-close
   ============================================================ */
function initModoButtons() {

    // Bouton d’ouverture
    const openBtn = $(".btn-open-modo");
    if (openBtn) {
        openBtn.addEventListener("click", openModoPanel);
    }

    // Bouton de fermeture dans le panel
    const closeBtn = $("#panel-modo .btn-close");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeModoPanel);
    }

    logRP("Boutons du Panthéon initialisés.");
}
/* ============================================================
   MAIN.JS — SECTION 5
   CHAT RP ONE PIECE
   ------------------------------------------------------------
   Objectif :
   - Gérer l’envoi de messages
   - Ajouter les messages dans la chat-box
   - Auto-scroll
   - Typage RP (RP, système, faction, narration)
   ============================================================ */


/* ============================================================
   AJOUT D’UN MESSAGE DANS LA CHAT-BOX
   ------------------------------------------------------------
   @param {string} text - contenu du message
   @param {string} type - "rp", "system", "faction", "narration"
   ============================================================ */
function addChatMessage(text, type = "rp") {

    const chatBox = $(".chat-box");
    if (!chatBox) return;

    // Création du conteneur
    const msg = document.createElement("div");
    msg.classList.add("chat-message");

    // Ajout du type RP
    if (type === "system") msg.classList.add("chat-system");
    if (type === "faction") msg.classList.add("chat-faction");
    if (type === "narration") msg.classList.add("chat-narration");

    // Contenu
    msg.textContent = text;

    // Ajout dans la box
    chatBox.appendChild(msg);

    // Auto-scroll
    chatBox.scrollTop = chatBox.scrollHeight;

    logRP("Message ajouté :", text);
}



/* ============================================================
   ENVOI D’UN MESSAGE (depuis l’input)
   ------------------------------------------------------------
   - Récupère le texte
   - Détermine le type (RP par défaut)
   - Ajoute le message
   - Vide l’input
   ============================================================ */
function sendChatMessage() {

    const input = $(".chat-input");
    if (!input) return;

    const text = input.value.trim();
    if (text === "") return;

    // Détection du type RP via préfixes (optionnel)
    let type = "rp";

    if (text.startsWith("/sys ")) {
        type = "system";
        text = text.replace("/sys ", "");
    }
    else if (text.startsWith("/faction ")) {
        type = "faction";
        text = text.replace("/faction ", "");
    }
    else if (text.startsWith("/nar ")) {
        type = "narration";
        text = text.replace("/nar ", "");
    }

    addChatMessage(text, type);

    input.value = "";
}



/* ============================================================
   INITIALISATION DU CHAT
   ------------------------------------------------------------
   - Bouton envoyer
   - Envoi avec Entrée
   ============================================================ */
function initChat() {

    const input = $(".chat-input");
    const sendBtn = $(".chat-send-btn");

    if (!input || !sendBtn) {
        logRP("Chat non trouvé dans le DOM.");
        return;
    }

    // Clic sur le bouton envoyer
    sendBtn.addEventListener("click", sendChatMessage);

    // Touche Entrée
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            sendChatMessage();
        }
    });

    logRP("Chat RP initialisé.");
}
