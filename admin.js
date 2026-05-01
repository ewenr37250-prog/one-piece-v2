$("btn-open-admin").onclick = () => $("admin-modal").classList.remove("hidden");
$("btn-close-admin").onclick = () => $("admin-modal").classList.add("hidden");

$("btn-modo-login").onclick = () => {
    socket.emit("modo:login", $("modo-code").value);
};

socket.on("modo:success", () => {
    $("admin-login-section").classList.add("hidden");
    $("admin-tools-section").classList.remove("hidden");
    const line = document.createElement("div");
    line.innerText = "> QG Connecté. Bienvenue Chevreuil.";
    $("modo-log").appendChild(line);
});

$("btn-modo-give").onclick = () => {
    socket.emit("modo:give_berries", { 
        target: $("modo-target").value, 
        amount: $("modo-berries").value 
    });
};

socket.on("modo:log", msg => {
    const line = document.createElement("div");
    line.innerText = `> ${msg}`;
    $("modo-log").appendChild(line);
    $("modo-log").scrollTop = $("modo-log").scrollHeight;
});
