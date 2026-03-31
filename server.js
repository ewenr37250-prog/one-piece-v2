require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

// Import des modèles et services
const { Player } = require('./models');
const { computePower } = require('./services/combat');
const { seedDatabase } = require('./services/init');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Connexion à la base de données
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log("⚓ Navigation stable : MongoDB Connecté");
        seedDatabase(); // Rplit la DB si elle est vide
    })
    .catch(err => console.error("❌ Erreur moteur DB :", err));

app.use(express.static('public'));

io.on('connection', (socket) => {
    // Rejoindre le jeu
    socket.on('join', async ({ name, faction }) => {
        let player = await Player.findOne({ name });
        if (!player) {
            player = new Player({ name, faction, bounty: 1000 });
            await player.save();
        }
        socket.playerName = name;
        sync(socket);
    });

    // Chat global
    socket.on('send-msg', (data) => {
        io.emit('receive-msg', { user: socket.playerName || "Inconnu", text: data.text });
    });

    // Synchronisation des stats
    async function sync(s) {
        const p = await Player.findOne({ name: s.playerName });
        if (p) {
            const power = computePower(p);
            s.emit('update-all', { player: p, power });
        }
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Serveur Horizon V4 lancé sur le port ${PORT}`));
