document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    
    // Éléments
    const btnLogin = document.getElementById('btn-login');
    const inputName = document.getElementById('log-name');
    const btnTrain = document.getElementById('btn-train');
    const inputMsg = document.getElementById('m');
    const btnSend = document.getElementById('s');
    const chatBox = document.getElementById('chat');

    // 1. Connexion
    btnLogin.onclick = () => {
        const name = inputName.value.trim();
        if (name) {
            socket.emit('auth:login', { name });
        }
    };

    socket.on('auth:success', (data) => {
        document.getElementById('auth').classList.add('hidden');
        document.getElementById('game').classList.remove('hidden');
        updateUI(data.player);
    });

    // 2. Gameplay (Boutons)
    btnTrain.onclick = () => {
        socket.emit('action:train');
    };

    socket.on('player:update', (player) => {
        updateUI(player);
    });

    function updateUI(p) {
        document.getElementById('p-name').innerText = p.name;
        document.getElementById('p-lvl').innerText = p.level;
        document.getElementById('bounty').innerText = p.bounty.toLocaleString();
        
        document.getElementById('hp-text').innerText = `${p.hp} / ${p.hpMax}`;
        document.getElementById('xp-text').innerText = `${p.xp} / ${p.xpNext}`;

        const hpPercent = (p.hp / p.hpMax) * 100;
        const xpPercent = (p.xp / p.xpNext) * 100;
        
        document.getElementById('hp-f').style.width = hpPercent + '%';
        document.getElementById('xp-f').style.width = xpPercent + '%';
    }

    // 3. Chat
    btnSend.onclick = () => {
        const text = inputMsg.value.trim();
        if (text) {
            socket.emit('chat:send', { text });
            inputMsg.value = "";
        }
    };

    inputMsg.onkeypress = (e) => {
        if (e.key === 'Enter') btnSend.click();
    };

    socket.on('chat:message', (m) => {
        const div = document.createElement('div');
        div.style.marginBottom = "5px";
        div.innerHTML = `<b style="color: #c4a04d;">${m.author}:</b> <span style="color: #ccc;">${m.text}</span>`;
        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
    });
});
