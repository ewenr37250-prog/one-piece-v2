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
const ADMIN_CODE = "RedaLeGoat";

let players = {};
let currentVersion = 'v3';
let newspaper = { title: "Édition Spéciale", content: "Bienvenue sur Grand Line...", author: "Morgan" };

if (fs.existsSync(DB_FILE)) {
    try { players = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')); } catch (e) { players = {}; }
}
const saveDB = () => fs.writeFileSync(DB_FILE, JSON.stringify(players, null, 2));

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    socket.emit('init', { currentVersion, newspaper });

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
        const p = players[user];
        io.emit('rp-message', { user, text });

        const oldXP = p.gradeXP;
        p.gradeXP += 10;
        if (Math.floor(p.gradeXP / 500) > Math.floor(oldXP / 500)) {
            p.skillPoints += 1;
            socket.emit('system-message', "✨ +1 Point de Compétence (SP) !");
        }
        saveDB();
        socket.emit('player-data', p);
    });

    socket.on('upgrade-skill', (skillKey) => {
        const p = players[socket.playerName];
        const costs = { force:1, intel:1, haki:3, reading:10 };
        const max = { force:10, intel:10, haki:5, reading:1 };
        
        if (p && p.skillPoints >= costs[skillKey] && p.skills[skillKey] < max[skillKey]) {
            p.skillPoints -= costs[skillKey];
            p.skills[skillKey]++;
            saveDB();
            socket.emit('player-data', p);
        }
    });

    socket.on('write-journal', (data) => {
        if (data.code === MASTER_CODE || data.code === ADMIN_CODE) {
            newspaper = { title: data.title, content: data.content, author: socket.playerName };
            io.emit('system-message', "🗞️ Nouvelle édition du Journal !");
            io.emit('journal-update', newspaper);
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

// UN SEUL LISTEN ICI
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ Serveur lancé sur : http://localhost:${PORT}`);
});
