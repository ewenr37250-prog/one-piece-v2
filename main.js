const socket = io();
const $ = id => document.getElementById(id);

// --- AUTHENTIFICATION ---
$("btn-login").onclick = () => {
    const name = $("log-name").value;
    if(name.length < 3) return alert("Nom trop court !");
    socket.emit("auth:login", { name });
};

socket.on("auth:success", data => {
    $("auth").classList.add("hidden");
    $("game").classList.remove("hidden");
    updateUI(data.player);
});

// --- NAVIGATION ---
document.querySelectorAll(".nav-item").forEach(btn => {
    btn.onclick = () => {
        const target = btn.getAttribute("data-target");
        document.querySelectorAll(".view-content").forEach(v => v.classList.add("hidden"));
        $(target).classList.remove("hidden");
    };
});

// --- GAMEPLAY ---
$("btn-train").onclick = () => socket.emit("action:train");

socket.on("player:update", p => updateUI(p));

function updateUI(p) {
    $("player-name").innerText = p.name;
    $("player-level").innerText = p.level;
    $("bounty-value").innerText = `${p.bounty.toLocaleString()} ฿`;
    
    // Bars avec animation
    const hpPct = (p.hp / p.hpMax) * 100;
    const xpPct = (p.xp / p.xpNext) * 100;
    
    $("hp-fill").style.width = hpPct + "%";
    $("hp-text").innerText = `${p.hp} / ${p.hpMax}`;
    
    $("xp-fill").style.width = xpPct + "%";
    $("xp-text").innerText = `${Math.floor(p.xp)} / ${p.xpNext}`;
}

// --- CHAT ---
$("chat-send").onclick = sendMessage;
$("chat-text").onkeypress = (e) => { if(e.key === "Enter") sendMessage(); };

function sendMessage() {
    const text = $("chat-text").value;
    if(!text) return;
    socket.emit("chat:send", { text });
    $("chat-text").value = "";
}

socket.on("chat:message", m => {
    const msgDiv = document.createElement("div");
    msgDiv.style.marginBottom = "5px";
    msgDiv.innerHTML = `<span style="color:#c4a04d; font-weight:bold;">${m.author}:</span> ${m.text}`;
    $("chat-messages").appendChild(msgDiv);
    $("chat-messages").scrollTop = $("chat-messages").scrollHeight;
});
