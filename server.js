const express = require('express');
const path = require('path');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: { origin: "*" }
});

// 1. Rend tous les fichiers du dossier actuel accessibles (images, css, js client)
app.use(express.static(__dirname));

// 2. ROUTE PRINCIPALE : Envoie index.html peu importe l'adresse tapée
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 3. LOGIQUE MULTIJOUEUR (SOCKET.IO)
io.on('connection', (socket) => {
    console.log('🏴‍☠️ Un pirate a rejoint le navire ! ID:', socket.id);

    socket.on('chat-message', (msg) => {
        io.emit('chat-message', msg);
    });

    socket.on('disconnect', () => {
        console.log('🏃 Un pirate est tombé à l’eau.');
    });
});

// 4. ÉCOUTE DU PORT (Indispensable pour Render)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`📂 Dossier actuel : ${__dirname}`);
});
