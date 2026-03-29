const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// 1. On dit au serveur que TOUS les fichiers sont à la racine (./)
app.use(express.static(path.join(__dirname, '.')));

// 2. On force l'ouverture de index.html quand on arrive sur le site
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 3. Système multijoueur de base
io.on('connection', (socket) => {
    console.log('🏴‍☠️ Un pirate a rejoint la partie !');
    
    socket.on('chat-message', (data) => {
        io.emit('chat-message', data);
    });

    socket.on('disconnect', () => {
        console.log('🏃 Un pirate a quitté le navire.');
    });
});

// 4. Lancement du serveur sur le port de Render (ou 3000)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Serveur One Piece actif sur le port ${PORT}`);
});
