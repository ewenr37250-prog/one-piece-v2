const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mongoose = require('mongoose');
const path = require('path');

const User = require('./models');
const engine = require('./combat');

// --- CONFIGURATION ---
const CODE_GC = "SMILE-777";        
const CODE_MP = "VOID-CENTURY-000"; 
const forbiddenNames = ["Luffy", "Zoro", "Nami", "Sanji", "Ace", "Kaido", "Shanks", "Teach"];
let globalMultiplier = 1; // Passe à 2 lors des events

// --- CONNEXION DB ---
const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/grandline";
mongoose.connect(mongoURI).then(() => console.log("⚓ DB Connectée"));

app.use(express.static(path.join(__dirname)));

// --- LOGIQUE TEMPS RÉEL ---
io.on('connection', (socket) => {
    let currentPlayer = null;

    // 1. CONNEXION ET GRADES
    socket.on('join-game', async (data) => {
        try {
            let role = "Joueur";
            let level = 0;
            const name = data.username.trim();

            if (data.secretCode === CODE_MP) { role = "Modo Principal"; level = 2; }
            else if (data.secretCode === CODE_GC) { role = "Grand Corsaire"; level = 1; }

            if (forbiddenNames.some(n => n.toLowerCase() === name.toLowerCase()) && level === 0) {
                return socket.emit('login-error', "Nom réservé aux légendes !");
            }

            let user = await User.findOne({ username: name });
            if (!user) {
                user = new User({ username: name, faction: data.faction, role: role, adminLevel: level });
                await user.save();
            }

            currentPlayer = user;
            socket.emit('login-success', {
                username: user.username, role: user.role, level: user.adminLevel,
                berrys: user.berrys, bounty: user.bounty, island: user.currentIsland
            });
        } catch (e) { socket.emit('login-error', "Erreur serveur."); }
    });

    // 2. ACTIONS DE JEU
    socket.on('player-action', async (data) => {
        if (!currentPlayer || currentPlayer.isJailed) return;

        const user = await User.findById(currentPlayer._id);
        
        if (data.type === 'train') {
            const gains = engine.calculateTrain(user.haki);
            user.puissance += gains.gainPuissance;
            user.haki += gains.gainHaki;
            socket.emit('event-start', `Entraînement réussi ! +${gains.gainPuissance} Puissance`);
        } 
        
        if (data.type === 'pillage') {
            const gain = engine.calculatePillage(user.puissance, globalMultiplier);
            user.berrys += gain;
            user.bounty += Math.floor(gain / 2);
            socket.emit('event-start', `Pillage réussi ! +${gain} Berrys`);
        }

        await user.save();
        socket.emit('login-success', user); // Update HUD
    });

    // 3. COMMANDES ADMIN & MODO
    socket.on('admin-command', async (data) => {
        if (!currentPlayer || currentPlayer.adminLevel < 1) return;

        // Commandes Modos (Level 1+)
        if (data.cmd === 'jail') {
            await User.findOneAndUpdate({ username: data.target }, { isJailed: true });
            io.emit('event-start', `${data.target} a été envoyé à Impel Down !`);
        }

        // Commandes Admin Principal (Level 2)
        if (currentPlayer.adminLevel === 2) {
            if (data.cmd === 'event-pillage') {
                globalMultiplier = 2;
                io.emit('event-start', "L'HEURE DU PILLAGE EST LÀ ! GAINS X2 !");
                setTimeout(() => { globalMultiplier = 1; }, 3600000); // 1h
            }
            if (data.cmd === 'spawn-fruit') {
                io.emit('event-start', "Un Fruit du Démon est apparu sur une île lointaine !");
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Serveur sur port ${PORT}`));
