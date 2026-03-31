const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mongoose = require('mongoose');
const path = require('path');

// Import du modèle de données (vérifie que ton fichier s'appelle bien models.js)
const User = require('./models');

// --- CONFIGURATION DU JEU ---
const CODE_GC = "SMILE-777";        // Code pour devenir Grand Corsaire
const CODE_MP = "VOID-CENTURY-000"; // Code pour devenir Modo Principal
const forbiddenNames = ["Luffy", "Zoro", "Nami", "Sanji", "Chopper", "Robin", "Franky", "Brook", "Jinbe", "Ace", "Sabo", "Kaido", "Big Mom", "Shanks", "Teach", "Hancock", "Mihawk"];

// --- CONNEXION MONGODB ---
// Remplace par ta variable d'environnement sur Render ou ton lien local
const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/grandline";

mongoose.connect(mongoURI)
  .then(() => console.log("✅ Connecté à la base de données Grand Line"))
  .catch(err => console.error("❌ Erreur de connexion DB:", err));

// --- MIDDLEWARES ---
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- LOGIQUE SOCKET.IO (LE CERVEAU) ---
io.on('connection', (socket) => {
    console.log('⚓ Un voyageur s\'approche des côtes...');

    // GESTION DE LA CONNEXION / CRÉATION
    socket.on('join-game', async (data) => {
        try {
            let userRole = "Joueur";
            let level = 0;
            const chosenName = data.username.trim();

            if (!chosenName) {
                return socket.emit('login-error', "Le nom ne peut pas être vide !");
            }

            // 1. Vérification des codes secrets pour les grades
            if (data.secretCode === CODE_MP) {
                userRole = "Modo Principal";
                level = 2;
            } else if (data.secretCode === CODE_GC) {
                userRole = "Grand Corsaire";
                level = 1;
            }

            // 2. Vérification de la Blacklist (sauf pour les modos/admins)
            const isForbidden = forbiddenNames.some(n => n.toLowerCase() === chosenName.toLowerCase());
            if (isForbidden && level === 0) {
                return socket.emit('login-error', "⚠️ Ce nom est réservé aux légendes de l'œuvre ou au staff !");
            }

            // 3. Recherche ou Création du joueur dans MongoDB
            let user = await User.findOne({ username: chosenName });

            if (!user) {
                // Nouveau joueur
                user = new User({
                    username: chosenName,
                    faction: data.faction,
                    role: userRole,
                    adminLevel: level,
                    berrys: 1000,
                    bounty: 0,
                    currentIsland: "Fuchsia Village",
                    hp: 100,
                    stamina: 100
                });
                await user.save();
                console.log(`🆕 Nouveau compte créé : ${chosenName} (${userRole})`);
            } else {
                // Joueur existant : on met à jour son grade si un code valide est fourni
                if (level > user.adminLevel) {
                    user.role = userRole;
                    user.adminLevel = level;
                    await user.save();
                }
                console.log(`💾 ${chosenName} est de retour.`);
            }

            // 4. Succès de la connexion
            socket.emit('login-success', {
                username: user.username,
                role: user.role,
                level: user.adminLevel,
                berrys: user.berrys,
                bounty: user.bounty,
                island: user.currentIsland
            });

            // On rejoint une "room" socket pour les messages privés/équipage plus tard
            socket.join(user.username);

        } catch (err) {
            console.error("Erreur login:", err);
            socket.emit('login-error', "Erreur technique dans les archives de Marie-Joie.");
        }
    });

    // --- ICI TU POURRAS AJOUTER LES ACTIONS DE JEU (Piller, Entraîner, Naviguer) ---
    
    socket.on('disconnect', () => {
        console.log('👤 Un joueur a quitté le navire.');
    });
});

// --- LANCEMENT DU SERVEUR ---
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`
    ===========================================
    🏴‍☠️  GRAND LINE SERVER ACTIF  🏴‍☠️
    ⚓  Port : ${PORT}
    🌐  Prêt pour l'aventure !
    ===========================================
    `);
});
