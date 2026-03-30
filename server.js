require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// --- CONFIGURATION & CODES ---
const CODES = {
    master: 'TartifletteDeLaHess', 
    super:  'RedaLeGoat'
};

// --- DATA STRUCTURES ---
let players = {};
let crews = { pirate: [], marine: [], revo: [] };
let worldState = {
    event: "L'horizon est calme...",
    journal: "Édition n°1 : Le One Piece existe-t-il vraiment ?",
    onePieceActive: false,
    marketModifier: 1.0,
    roadPoneglyphes: { 1: "Caché", 2: "Caché", 3: "Caché", 4: "Caché" }
};
let msgHistory = [];

const FACTION_GRADES = {
    pirate: ['Mousse','Matelot','Second','Capitaine','Commodore','Amiral de flotte'],
    marine: ['Recrue','Soldat','Sergent','Lieutenant','Vice-Amiral','Amiral Chef'],
    revo:   ['Initié','Agent','Cadre','Commandant','Chef de corps','Chef suprême']
};

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    socket.emit('init', { worldState, players, history: msgHistory });

    socket.on('join', ({ name, faction }) => {
        if (!players[name]) {
            players[name] = {
                name, faction, bounty: 1000, gradeXP: 0, gradeIdx: 0,
                grade: FACTION_GRADES[faction] ? FACTION_GRADES[faction][0] : 'Mousse',
                power: 10,
                fruit: { name: "Aucun", level: 0, coeff: 1.0 },
                haki: { obs: 0, arm: 0, kings: 0 },
                skills: { force: 0, stealth: 0, fruitMastery: 0, intel: 0, canReadPoneglyph: false },
                crew: null, inventory: [], logsFound: 0
            };
        }
        socket.playerName = name;
        updatePlayer(name);
    });

    socket.on('rp-message', ({ user, text, channel }) => {
        const p = players[user];
        if (!p) return;

        p.bounty += Math.floor(Math.random() * 200) + 100;
        p.gradeXP += 5;
        p.power = Math.floor((p.bounty / 10000) + (p.skills.fruitMastery * 10) + (p.gradeIdx * 50) + (p.haki.arm * 100));

        const msg = { user, text, faction: p.faction, channel: channel || 'public', power: p.power };
        msgHistory.push(msg);
        if (msgHistory.length > 50) msgHistory.shift();
        
        io.emit('rp-message', msg);
        updatePlayer(user);
    });

    socket.on('admin-action', ({ code, action, data }) => {
        const isMaster = (code === CODES.master);
        const isSuper  = (code === CODES.super);
        
        if (!isMaster && !isSuper) return socket.emit('error', 'Code incorrect');

        if (action === 'update-journal' && isMaster) {
            worldState.journal = data;
            io.emit('world-update', worldState);
        }
        if (action === 'toggle-onepiece' && isMaster) {
            worldState.onePieceActive = !worldState.onePieceActive;
            io.emit('world-update', worldState);
        }
        if (action === 'give-fruit') {
            if (players[data.target]) {
                players[data.target].fruit = { name: data.fruitName, level: 1, coeff: data.coeff };
                updatePlayer(data.target);
            }
        }
    });

    function updatePlayer(name) {
        io.emit('leaderboard-update', players);
        socket.emit('player-data', players[name]);
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`⚓ Horizon V3 Online - Port ${PORT}`));
