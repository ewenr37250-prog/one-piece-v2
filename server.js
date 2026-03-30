require('dotenv').config();
const express = require('express');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const DB_FILE = './database.json';
const CODES = { master: "TartifletteDeLaHess", super: "Tartiflette", admin: "RedaLeGoat" };

let players = {};
let currentVersion = 'v3';
let worldEvent = "L'horizon est dégagé...";

if (fs.existsSync(DB_FILE)) {
    try { players = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')); } catch (e) { players = {}; }
}
const saveDB = () => fs.writeFileSync(DB_FILE, JSON.stringify(players, null, 2));

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    socket.emit('init', { currentVersion, worldEvent, players });

    socket.on('join', ({ name, faction }) => {
        socket.playerName = name;
        if (!players[name]) {
            players[name] = {
                name, faction: faction || 'pirate', bounty: 1000, 
                gradeXP: 0, skillPoints: 0, skills: { force: 0, intel: 0, haki: 0, reading: 0 }
            };
            saveDB();
        }
        io.emit('leaderboard-update', players);
        socket.emit('player-data', players[name]);
    });

    socket.on('rp-message', ({ user, text }) => {
        if (!players[user]) return;
        // Gain de prime dynamique : entre 150 et 400 par message pour le sentiment de progression
        players[user].bounty += Math.floor(Math.random() * 250) + 150;
        players[user].gradeXP += 10;
        if (players[user].gradeXP % 500 === 0) players[user].skillPoints++;
        
        saveDB();
        io.emit('rp-message', { user, text, faction: players[user].faction });
        io.emit('leaderboard-update', players);
        socket.emit('player-data', players[user]);
    });

    socket.on('upgrade-skill', (skill) => {
        const p = players[socket.playerName];
        const costs = { force: 1, intel: 1, haki: 3, reading: 10 };
        if (p && p.skillPoints >= costs[skill]) {
            p.skillPoints -= costs[skill];
            p.skills[skill]++;
            saveDB();
            socket.emit('player-data', p);
        }
    });

    socket.on('send-poster', ({ targetName, imageUrl, code }) => {
        if (code === CODES.master || code === CODES.super) {
            if (players[targetName]) {
                io.emit('show-poster', { 
                    targetName, imageUrl, 
                    bounty: players[targetName].bounty,
                    faction: players[targetName].faction 
                });
            }
        }
    });

    socket.on('admin-action', ({ type, value, code }) => {
        if (code === CODES.master && type === 'version') {
            currentVersion = value;
            io.emit('update-version', value);
        }
        if ((code === CODES.master || code === CODES.super) && type === 'event') {
            worldEvent = value;
            io.emit('world-event-update', value);
        }
    });

    socket.on('admin-auth', (code, cb) => {
        if (code === CODES.master) cb({ level: 'master' });
        else if (code === CODES.super) cb({ level: 'supermodo' });
        else if (code === CODES.admin) cb({ level: 'admin' });
        else cb(false);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`⚓ Système Horizon V3 lancé sur le port ${PORT}`));
