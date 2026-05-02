document.addEventListener('DOMContentLoaded', () => {
    const socket = io(); // Utilise l'instance Socket.io existante

    // Éléments
    const btnOpenModo = document.getElementById('btn-open-modo'); // À ajouter sur ton bouton QG
    const modoModal = document.getElementById('modo-modal');
    const btnAuth = document.getElementById('btn-modo-auth');
    const modoCode = document.getElementById('modo-code');
    const modoTools = document.getElementById('modo-tools');
    const modoLogin = document.getElementById('modo-login');
    
    const btnGive = document.getElementById('btn-modo-give');
    const targetInput = document.getElementById('modo-target');
    const amountInput = document.getElementById('modo-amount');
    const logArea = document.getElementById('modo-log');

    // Ouvrir la modale
    if(btnOpenModo) {
        btnOpenModo.onclick = () => modoModal.classList.remove('hidden');
    }

    // Authentification Modo
    btnAuth.onclick = () => {
        const code = modoCode.value;
        socket.emit('modo:login', code);
    };

    socket.on('modo:success', () => {
        modoLogin.classList.add('hidden');
        modoTools.classList.remove('hidden');
        addLog("Accès autorisé. Bienvenue, Administrateur.");
    });

    // Actions
    btnGive.onclick = () => {
        const target = targetInput.value;
        const amount = amountInput.value;
        if(target && amount) {
            socket.emit('modo:give_berries', { target, amount });
        }
    };

    socket.on('modo:log', (msg) => {
        addLog(msg);
    });

    function addLog(msg) {
        const entry = document.createElement('div');
        entry.innerText = `> ${msg}`;
        logArea.appendChild(entry);
        logArea.scrollTop = logArea.scrollHeight;
    }
});
