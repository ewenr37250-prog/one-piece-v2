require('dotenv').config();
const express = require('express');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const DB_FILE = './database.json';
const MASTER_CODE = "TartifletteDeLaHess"; 
const SUPER_MODO_CODE = "Tartiflette";
const ADMIN_CODE = "RedaLeGoat";

let players = {};
let currentVersion = 'v3';
let worldEvent = "Calme plat sur Grand Line";

if (fs.existsSync(DB_FILE)) {
    try { players = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')); } catch (e) { players = {}; }
}
const saveDB = () => fs.writeFileSync(DB_FILE, JSON.stringify(players, null, 2));

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    socket.emit('init', { currentVersion, worldEvent });

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
        if (!players[user]) return;
        io.emit('rp-message', { user, text });
        players[user].gradeXP += 10;
        if (players[user].gradeXP % 500 === 0) players[user].skillPoints++;
        saveDB();
        socket.emit('player-data', players[user]);
    });

    // GESTION DES ÉVÉNEMENTS (Super Modo & Master)
    socket.on('set-world-event', ({ eventType, customText, code }) => {
        if (code === MASTER_CODE || code === SUPER_MODO_CODE) {
            worldEvent = customText || eventType;
            io.emit('world-event-update', worldEvent);
            io.emit('system-message', `📢 ALERTE MONDIALE : ${worldEvent}`);
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
        else if (code === SUPER_MODO_CODE) cb({ level: 'supermodo' });
        else if (code === ADMIN_CODE) cb({ level: 'admin' });
        else cb(false);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ Serveur One Piece V3 prêt sur le port ${PORT}`);
});
