let socket = null;
let me = {};

function initSocket() {
    if (socket) return;
    socket = io();

    socket.on('auth:success', ({token, player}) => {
        me = player;
        document.getElementById('overlay').style.display = 'none';
        document.getElementById('app').classList.add('on');
        renderPlayer(player);
    });

    socket.on('player:update', p => {
        me = p;
        renderPlayer(p);
    });
}

function renderPlayer(p) {
    document.getElementById('tb-name').textContent = p.name;
    document.getElementById('s-bounty').textContent = p.bounty.toLocaleString();
    document.getElementById('s-berries').textContent = p.berries.toLocaleString();
}

function act(type) {
    socket.emit('act', type);
}

// Fonctions d'UI (Tabs, Burger...)
function switchTab(t) { /* logique de switch */ }
