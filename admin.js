function admDo(action) {
    const target = document.getElementById('a-target').value;
    const val = document.getElementById('a-value').value;
    const code = document.getElementById('a-code').value;

    if (!code) return alert("Code admin requis");

    socket.emit('admin:action', { action, target, val, code });
}

function admBroadcast() {
    const msg = document.getElementById('a-broadcast').value;
    socket.emit('admin:broadcast', { msg });
}
