const socket = io();
let player = null;

const $ = id => document.getElementById(id);

$("btn-login").onclick = () => {
    socket.emit("auth:login", { name: $("log-name").value, password: $("log-pass").value });
};

socket.on("auth:success", data => {
    player = data.player;
    document.getElementById("auth").classList.add("hidden");
    document.getElementById("game").classList.remove("hidden");
    updateUI();
});

socket.on("player:update", p => { player = p; updateUI(); });

function updateUI() {
    if (!player) return;
    $("player-name").innerText = player.name;
    $("player-level").innerText = `Niv ${player.level}`;
    $("hp-text").innerText = `HP ${player.hp}/${player.hpMax}`;
    $("hp-fill").style.width = (player.hp / player.hpMax * 100) + "%";
    $("xp-text").innerText = `XP ${player.xp}/${Math.floor(player.xpNext)}`;
    $("xp-fill").style.width = (player.xp / player.xpNext * 100) + "%";
    $("stat-berries").innerText = `Berries: ${player.berries} ฿`;
}

// Onglets
document.querySelectorAll(".menu-tabs button").forEach(btn => {
    btn.onclick = () => {
        const target = btn.getAttribute("data-target");
        if (!target) return;
        document.querySelectorAll(".parchment-view").forEach(v => v.classList.remove("active"));
        $(target).classList.add("active");
    };
});

$("btn-train").onclick = () => socket.emit("action:train");
$("btn-work").onclick = () => socket.emit("action:work");

socket.on("action:result", res => { $("action-result").innerText = res.text; });

// Chat
$("chat-send").onclick = () => {
    socket.emit("chat:send", { text: $("chat-text").value });
    $("chat-text").value = "";
};

socket.on("chat:message", msg => {
    const div = document.createElement("div");
    div.innerHTML = `<b>${msg.author}:</b> ${msg.text}`;
    $("chat-messages").appendChild(div);
    $("chat-messages").scrollTop = $("chat-messages").scrollHeight;
});
