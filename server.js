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
let marketPrices = { 'Sabre de Marine': 50000, 'Log Pose': 15000, 'Rhum': 2000, 'Fruit du Démon': 5000000 };
let newspaper = { title: "Édition Spéciale", content: "Bienvenue sur la V3 Gold...", author: "Morgan" };

if (fs.existsSync(DB_FILE)) {
    try { players = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')); } catch (e) { players = {}; }
}
const saveDB = () => fs.writeFileSync(DB_FILE, JSON.stringify(players, null, 2));

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    socket.emit('init', { currentVersion, worldEvent, marketPrices, newspaper });

    socket.on('join', ({ name, faction }) => {
        socket.playerName = name;
        if (!players[name]) {
            players[name] = {
                name, faction, bounty: 5000, gradeXP: 0, skillPoints: 0,
                skills: { force: 0, intel: 0, haki: 0, reading: 0 }, inventory: []
            };
            saveDB();
        }
        socket.emit('player-data', players[name]);
    });

    socket.on('rp-message', ({ user, text }) => {
        if (!players[user]) return;
        io.emit('rp-message', { user, text });
        players[user].gradeXP += 10;
        if (players[user].gradeXP % 200 === 0) {
            players[user].skillPoints++;
            socket.emit('system-message', "✨ +1 Point de Compétence (SP) !");
        }
        saveDB();
        socket.emit('player-data', players[user]);
    });

    socket.on('upgrade-skill', (skillKey) => {
        const p = players[socket.playerName];
        const costs = { force:1, intel:1, haki:3, reading:10 };
        if (p && p.skillPoints >= costs[skillKey]) {
            p.skillPoints -= costs[skillKey];
            p.skills[skillKey]++;
            saveDB();
            socket.emit('player-data', p);
        }
    });

    socket.on('buy-item', (itemName) => {
        const p = players[socket.playerName];
        if (p && p.bounty >= marketPrices[itemName]) {
            p.bounty -= marketPrices[itemName];
            p.inventory.push(itemName);
            marketPrices[itemName] = Math.round(marketPrices[itemName] * 1.05);
            io.emit('market-update', marketPrices);
            socket.emit('player-data', p);
            saveDB();
        }
    });

    socket.on('admin-action', ({ type, value, code, extra }) => {
        const isMaster = code === MASTER_CODE;
        const isSuper = code === SUPER_MODO_CODE;
        const isAdmin = code === ADMIN_CODE;

        if (type === 'version' && isMaster) {
            currentVersion = value;
            io.emit('update-version', value);
        } else if (type === 'event' && (isMaster || isSuper)) {
            worldEvent = value;
            io.emit('world-event-update', value);
            io.emit('system-message', `📢 ALERTE : ${value}`);
        } else if (type === 'journal' && (isMaster || isSuper || isAdmin)) {
            newspaper = { title: value, content: extra, author: socket.playerName };
            io.emit('journal-update', newspaper);
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
server.listen(PORT, () => console.log(`Serveur prêt sur http://localhost:${PORT}`));
