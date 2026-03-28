const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Connexion MongoDB
const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/onepiece";
mongoose.connect(mongoURI)
    .then(() => console.log("⚓ Connecté à la base de données de Grand Line"))
    .catch(err => console.error("❌ Erreur de connexion:", err));

app.use(express.static(path.join(__dirname, '../')));

// Système Multijoueur Temps Réel
io.on('connection', (socket) => {
    console.log('🏴‍☠️ Un nouveau pirate a rejoint l\'équipage:', socket.id);

    socket.on('chat-message', (data) => {
        io.emit('chat-message', data); // Envoie le message à TOUT LE MONDE en direct
    });

    socket.on('disconnect', () => {
        console.log('👋 Un pirate a quitté le navire');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Serveur lancé sur le port ${PORT}`);
});
