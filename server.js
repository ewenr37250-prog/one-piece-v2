const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Pour que ton index.html s'affiche
app.use(express.static(path.join(__dirname, '../')));

io.on('connection', (socket) => {
    console.log('🏴‍☠️ Un pirate est connecté !');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Serveur prêt sur le port ${PORT}`);
});
