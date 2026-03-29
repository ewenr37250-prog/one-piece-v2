const express = require('express');
const path = require('path');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: { origin: "*" }
});

app.use(express.static(__dirname));

app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    console.log('Un nouveau pirate est arrive');

    socket.on('rp-message', (data) => {
        io.emit('rp-message', data);
    });

    socket.on('admin-update-bounty', (data) => {
        io.emit('bounty-updated', data);
    });

    socket.on('admin-announcement', (text) => {
        io.emit('global-alert', text);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('Serveur en ligne sur le port ' + PORT);
});
