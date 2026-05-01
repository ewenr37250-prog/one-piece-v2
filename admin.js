$("btn-open-admin").onclick = () => $("admin-modal").classList.remove("hidden");
$("btn-close-admin").onclick = () => $("admin-modal").classList.add("hidden");

$("btn-modo-login").onclick = () => {
    socket.emit("modo:login", $("modo-code").value);
};

socket.on("modo:success", () => {
    $("admin-login-section").classList.add("hidden");
    $("admin-tools-section").classList.remove("hidden");
    const log = document.createElement("div");
    log.innerText = "> Connecté au QG.";
    $("modo-log").appendChild(log);
});

socket.on("modo:fail", () => { alert("Code erroné !"); });
