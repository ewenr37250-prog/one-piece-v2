const express = require('express');
const path = require('path');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    console.log('⚓ Un nouveau destin s'écrit...');

    // Relais des messages RP et actions
    socket.on('rp-message', (data) => {
        io.emit('rp-message', data);
    });

    // COMMANDE ADMIN : Mise à jour de prime
    socket.on('admin-update-bounty', (data) => {
        // Seuls Imu et les Doyens déclenchent ça
        io.emit('bounty-updated', data);
    });

    // COMMANDE ADMIN : Annonce Mondiale
    socket.on('admin-announcement', (text) => {
        io.emit('global-alert', text);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Marine Forge active sur le port ${PORT}`));
