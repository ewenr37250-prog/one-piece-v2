const socket = io();
let player = null;
const $ = id => document.getElementById(id);

// Login
$("btn-login").onclick = () => {
    socket.emit("auth:login", { 
        name: $("log-name").value, 
        faction: $("log-faction").value 
    });
};

socket.on("auth:success", data => {
    player = data.player;
    $("auth").classList.add("hidden");
    $("game").classList.remove("hidden");
    updateUI();
});

socket.on("player:update", p => { player = p; updateUI(); });

function updateUI() {
    if(!player) return;
    $("player-name").innerText = player.name;
    $("hp-text").innerText = `HP ${player.hp}/${player.hpMax}`;
    $("hp-fill").style.width = (player.hp / player.hpMax * 100) + "%";
    $("xp-text").innerText = `XP ${player.xp}/${player.xpNext}`;
    $("xp-fill").style.width = (player.xp / player.xpNext * 100) + "%";
    $("stat-berries").innerText = `Berries: ${player.berries} ฿`;
    $("bounty-value").innerText = `${player.bounty} ฿`;
}

// Actions
$("btn-train").onclick = () => socket.emit("action:train");
socket.on("action:result", res => { $("action-result").innerText = res.text; });

// Chat
$("chat-send").onclick = () => { socket.emit("chat:send", { text: $("chat-text").value }); $("chat-text").value = ""; };
socket.on("chat:message", m => {
    const div = document.createElement("div");
    div.innerHTML = `<b style="color:var(--gold)">${m.author}:</b> ${m.text}`;
    $("chat-messages").appendChild(div);
    $("chat-messages").scrollTop = $("chat-messages").scrollHeight;
});
