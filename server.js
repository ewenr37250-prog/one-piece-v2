require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

const DB_FILE = './database.json';
const ADMIN_CODE = process.env.ADMIN_CODE || 'RedaLeGoat';
const MASTER_CODE = "TartifletteDeLaHess";

// --- PERSISTANCE ---
let players = {};
if (fs.existsSync(DB_FILE)) {
    try { players = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')); } 
    catch (e) { players = {}; }
}
const saveDB = () => fs.writeFileSync(DB_FILE, JSON.stringify(players, null, 2));

// --- DATA CONFIG ---
const FACTIONS = {
    pirate: { label: 'Pirates', color: '#e74c3c', grades: ['Mousse','Matelot','Second','Capitaine','Commodore','Amiral de flotte'] },
    marine: { label: 'Marine', color: '#3498db', grades: ['Recrue','Soldat','Sergent','Lieutenant','Capitaine','Amiral'] },
    revo:   { label: 'Révolutionnaires', color: '#2ecc71', grades: ['Partisan','Agent','Officier','Commandant','Général'] }
};

const quests = [
    { id:1, title:'Traversée du Grand Line', goal:5, minChars:40, faction:'all', reward:100000 },
    { id:2, title:'Chasse à l\'homme', goal:10, minChars:30, faction:'marine', reward:250000 },
    { id:3, title:'Pillage de navire', goal:10, minChars:30, faction:'pirate', reward:300000 }
];

let marketPrices = { 'Sabre de qualité': 50000, 'Boussole Log Pose': 15000, 'Rhum de Baratie': 2000, 'Fruit Inconnu': 5000000 };
let newspaper = { title: "Édition Spéciale", content: "Bienvenue sur les mers...", author: "Morgan", price: 100 };
const history = [];

app.use(express.static(__dirname));
app.get('*', (req, res) => res.sendFile(path.resolve(__dirname, 'index.html')));

io.on('connection', (socket) => {
    socket.emit('init', { players, quests, marketPrices, history });

    socket.on('join', ({ name, faction }) => {
        socket.playerName = name;
        if (!players[name]) {
            players[name] = {
                name, faction, bounty: 500, gradeXP: 0, gradeIdx: 0,
                inventory: [], questProgress: {},
                skills: { force: 1, intel: 1, haki: 0, reading: 0 },
                fruit: null
            };
            saveDB();
        }
        socket.emit('player-data', players[name]);
        io.emit('player-list', players);
    });

    socket.on('rp-message', ({ user, text, channel }) => {
        if (!players[user]) return;
        const p = players[user];
        const msg = { user, text, channel: channel || 'rp', ts: Date.now() };
        
        history.push(msg);
        if(history.length > 50) history.shift();
        io.emit('rp-message', msg);

        // Anti-Fraude Quêtes
        quests.forEach(q => {
            if (q.faction === 'all' || q.faction === p.faction) {
                if (!p.questProgress[q.id]) p.questProgress[q.id] = 0;
                if (p.questProgress[q.id] < q.goal && text.length >= q.minChars) {
                    p.questProgress[q.id]++;
                    socket.emit('quest-progress', { id: q.id, cur: p.questProgress[q.id] });
                    if (p.questProgress[q.id] === q.goal) {
                        p.bounty += q.reward;
                        io.emit('system-message', `🏆 ${user} a fini la quête : ${q.title} !`);
                    }
                }
            }
        });

        p.gradeXP += 5;
        // Auto-Grade
        const thresholds = [0, 100, 400, 1000, 2500, 5000];
        if (p.gradeXP >= thresholds[p.gradeIdx + 1] && p.gradeIdx < FACTIONS[p.faction].grades.length - 1) {
            p.gradeIdx++;
            io.emit('system-message', `🎊 ${user} est promu au rang de ${FACTIONS[p.faction].grades[p.gradeIdx]} !`);
        }
        
        saveDB();
        socket.emit('player-data', p);
    });

    // MARCHÉ & JOURNAL
    socket.on('buy-item', (itemName) => {
        const p = players[socket.playerName];
        if (p && p.bounty >= marketPrices[itemName]) {
            p.bounty -= marketPrices[itemName];
            p.inventory.push(itemName);
            marketPrices[itemName] = Math.round(marketPrices[itemName] * 1.05); // Fluctuation
            io.emit('market-update', marketPrices);
            socket.emit('player-data', p);
            saveDB();
        }
    });

    socket.on('buy-journal', () => {
        const p = players[socket.playerName];
        if (p && p.bounty >= newspaper.price) {
            p.bounty -= newspaper.price;
            socket.emit('journal-content', newspaper);
            socket.emit('player-data', p);
            saveDB();
        }
    });

    socket.on('write-journal', (data) => {
        if (data.code === MASTER_CODE || data.code === ADMIN_CODE) {
            newspaper = { ...data, author: socket.playerName };
            io.emit('system-message', "🗞️ Nouvelle édition du Mizu Mizu Journal disponible !");
        }
    });

    socket.on('admin-auth', (code, cb) => {
        if (code === MASTER_CODE) cb({ level: 'master' });
        else if (code === ADMIN_CODE) cb({ level: 'admin' });
        else cb(false);
    });
});

server.listen(3000);
