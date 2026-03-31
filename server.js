require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

// --- CORRECTION DES CHEMINS ---
// On importe directement depuis la racine
const { Player } = require('./models'); 
const { computePower } = require('./combat'); 

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Connexion à la base de données
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log("⚓ Navigation stable : MongoDB Connecté");
    })
    .catch(err => console.error("❌ Erreur moteur DB :", err));

app.use(express.static('public'));

io.on('connection', (socket) => {
    socket.on('join', async ({ name, faction }) => {
        try {
            let player = await Player.findOne({ name });
            if (!player) {
                player = new Player({ 
                    name, 
                    faction, 
                    bounty: 1000,
                    berries: 1000,
                    haki: { observation: 0, armement: 0, rois: 0 },
                    skills: { force: 0, maitrise: 0 }
                });
                await player.save();
            }
            socket.playerName = name;
            sync(socket);
        } catch (e) { console.error("Erreur Join:", e); }
    });

    socket.on('send-msg', (data) => {
        io.emit('receive-msg', { user: socket.playerName || "Inconnu", text: data.text });
    });

    async function sync(s) {
        const p = await Player.findOne({ name: s.playerName });
        if (p) {
            const power = computePower(p);
            s.emit('update-all', { player: p, power });
        }
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Serveur Horizon lancé sur le port ${PORT}`));
