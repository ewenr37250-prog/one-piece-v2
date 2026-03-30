require('dotenv').config();
const express = require('express');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const DB_FILE = './database.json';
const MASTER_CODE = "TartifletteDeLaHess"; // Ton code secret
const ADMIN_CODE = "RedaLeGoat";

let players = {};
let currentVersion = 'v3';

// Chargement de la base de données
if (fs.existsSync(DB_FILE)) {
    try {
        players = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    } catch (e) {
        players = {};
    }
}

const saveDB = () => fs.writeFileSync(DB_FILE, JSON.stringify(players, null, 2));

const SKILLS_CONFIG = {
    force: { label: "Force", max: 10, cost: 1 },
    intel: { label: "Intelligence", max: 10, cost: 1 },
    haki: { label: "Haki", max: 5, cost: 3 },
    reading: { label: "Lecture Antique", max: 1, cost: 10 }
};

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    // Envoi de la version actuelle au nouveau connecté
    socket.emit('init', { currentVersion });

    socket.on('join', ({ name, faction }) => {
        socket.playerName = name;
        if (!players[name]) {
            players[name] = {
                name, faction, bounty: 1000, gradeXP: 0, gradeIdx: 0, skillPoints: 0,
                skills: { force: 0, intel: 0, haki: 0, reading: 0 }
            };
            saveDB();
        }
        socket.emit('player-data', players[name]);
    });

    socket.on('rp-message', ({ user, text }) => {
        const p = players[user];
        if (!p) return;

        io.emit('rp-message', { user, text, ts: Date.now() });

        // Calcul XP et gain de Points de Compétence (SP)
        const oldXP = p.gradeXP;
        p.gradeXP += 10; 
        
        // On donne 1 SP tous les 500 XP
        if (Math.floor(p.gradeXP / 500) > Math.floor(oldXP / 500)) {
            p.skillPoints += 1;
            socket.emit('system-message', "✨ +1 Point de Compétence (SP) obtenu !");
        }

        // Système de Grade automatique
        const thresholds = [0, 100, 500, 1500, 4000, 10000];
        if (p.gradeXP >= thresholds[p.gradeIdx + 1] && p.gradeIdx < 5) {
            p.gradeIdx++;
            io.emit('system-message', `🎊 ${user} monte en grade !`);
        }
        
        saveDB();
        socket.emit('player-data', p);
    });

    socket.on('upgrade-skill', (skillKey) => {
        const p = players[socket.playerName];
        const cfg = SKILLS_CONFIG[skillKey];
        if (p && p.skillPoints >= cfg.cost && p.skills[skillKey] < cfg.max) {
            p.skillPoints -= cfg.cost;
            p.skills[skillKey]++;
            saveDB();
            socket.emit('player-data', p);
        }
    });

    socket.on('set-version', ({ version, code }) => {
        if (code === MASTER_CODE) {
            currentVersion = version;
            io.emit('update-version', version);
        }
    });

    socket.on('admin-auth', (code, cb) => {
        if (code === MASTER_CODE) cb({ level: 'master' });
        else if (code === ADMIN_CODE) cb({ level: 'admin' });
        else cb(false);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));

server.listen(3000);
