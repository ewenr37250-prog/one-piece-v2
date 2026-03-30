require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, { cors: { origin: '*' } });

const DB_FILE = './database.json';
const ADMIN_CODE = process.env.ADMIN_CODE || 'RedaLeGoat';
const MASTER_CODE = "TartifletteDeLaHess";

// --- INITIALISATION DATABASE ---
let players = {};
if (fs.existsSync(DB_FILE)) {
    try {
        players = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    } catch (e) { console.error("Erreur DB:", e); players = {}; }
}
const saveDB = () => fs.writeFileSync(DB_FILE, JSON.stringify(players, null, 2));

// --- DATA DU MONDE ---
const FACTION_GRADES = {
    pirate: ['Mousse','Matelot','Second','Capitaine','Commodore','Amiral de flotte'],
    marine: ['Recrue','Soldat','Sergent','Lieutenant','Capitaine','Vice-amiral','Amiral'],
    revo:   ['Partisan','Agent','Chef de cellule','Officier','Commandant','Général']
};

const quests = [
    { id:1, title:'Traversée du Grand Line', type:'MSG', goal:3, minChars:50, faction:'all', reward:500000 },
    { id:2, title:'Chasse à la Prime', type:'MSG', goal:10, minChars:30, faction:'pirate', reward:1500000 },
    { id:3, title:'Ordre Public', type:'MSG', goal:10, minChars:30, faction:'marine', reward:800000 },
    { id:4, title:'Propagande', type:'MSG', goal:10, minChars:30, faction:'revo', reward:800000 }
];

let worldEvent = null;
const history = [];

// --- LOGIQUE SOCKET ---
app.use(express.static(__dirname));
app.get('*', (req, res) => res.sendFile(path.resolve(__dirname, 'index.html')));

io.on('connection', (socket) => {
    socket.emit('init', { players, quests, worldEvent, history });

    socket.on('join', ({ name, faction }) => {
        socket.playerName = name;
        if (!players[name]) {
            players[name] = {
                name, faction, bounty:0, influence:0, gradeXP:0, gradeIdx:0,
                grade: FACTION_GRADES[faction]?.[0] || 'Inconnu',
                inventory: [], questProgress: {}, 
                skills: { force:1, intel:1, haki:0 }, 
                fruit: null
            };
            saveDB();
        }
        socket.emit('player-data', players[name]);
        io.emit('player-list', players);
    });

    socket.on('rp-message', ({ user, text, channel }) => {
        if (!players[user]) return;
        const msg = { user, text, channel: channel || 'rp', ts: Date.now() };
        history.push(msg);
        if (history.length > 50) history.shift();
        io.emit('rp-message', msg);

        // --- ANTI-FRAUDE QUÊTES ---
        const p = players[user];
        quests.forEach(q => {
            if (q.faction === 'all' || q.faction === p.faction) {
                if (!p.questProgress[q.id]) p.questProgress[q.id] = 0;
                if (p.questProgress[q.id] < q.goal && text.length >= q.minChars) {
                    p.questProgress[q.id]++;
                    socket.emit('quest-update-progress', { id: q.id, cur: p.questProgress[q.id], goal: q.goal });
                    if (p.questProgress[q.id] === q.goal) {
                        p.bounty += q.reward;
                        io.emit('system-message', `🏆 ${user} a accompli : ${q.title} !`);
                    }
                }
            }
        });

        p.gradeXP += 10;
        checkGrade(user);
        saveDB();
        socket.emit('player-data', p);
    });

    socket.on('admin-auth', (code, cb) => {
        if (code === MASTER_CODE) return cb({ level: 'master' });
        if (code === ADMIN_CODE) return cb({ level: 'admin' });
        cb(false);
    });

    socket.on('admin-action', ({ type, target, value }) => {
        if (players[target]) {
            if (type === 'bounty') players[target].bounty = Number(value);
            if (type === 'grade') players[target].grade = value;
            if (type === 'kick') { /* Logique kick */ }
            saveDB();
            io.emit('player-list', players);
        }
    });
});

function checkGrade(name) {
    const p = players[name];
    const thresholds = [0, 100, 300, 800, 1500, 3000, 6000];
    if (p.gradeXP >= thresholds[p.gradeIdx + 1] && p.gradeIdx < FACTION_GRADES[p.faction].length - 1) {
        p.gradeIdx++;
        p.grade = FACTION_GRADES[p.faction][p.gradeIdx];
        io.emit('system-message', `🎊 Promotion : ${name} est passé ${p.grade} !`);
    }
}

server.listen(3000, () => console.log("Serveur V3 en ligne sur le port 3000"));
