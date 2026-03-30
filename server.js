require('dotenv').config();
const express = require('express');
const fs = require('fs');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, { cors: { origin: '*' } });

// --- CONFIGURATION & DATABASE ---
const ADMIN_CODE = process.env.ADMIN_CODE || 'RedaLeGoat';
const MASTER_CODE = "TartifletteDeLaHess"; 
const DB_FILE = './database.json';

let players = {};
let worldEvent = null;
const history = [];

// Chargement des données au démarrage
if (fs.existsSync(DB_FILE)) {
    players = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    console.log("[DB] Données joueurs chargées.");
}

const saveDB = () => fs.writeFileSync(DB_FILE, JSON.stringify(players, null, 2));

const FACTION_GRADES = {
    pirate: ['Mousse','Matelot','Second','Capitaine','Commodore','Amiral de flotte'],
    marine: ['Recrue','Soldat','Sergent','Lieutenant','Capitaine','Vice-amiral','Amiral'],
    revo:   ['Partisan','Agent','Chef de cellule','Officier','Commandant','Général']
};

const quests = [
    { id:1, title:'Traversée du Grand Line', type:'MSG_COUNT', goal:3, minChars:50, faction:'all', reward:500000 },
    { id:2, title:'Entraînement Intensif', type:'MSG_COUNT', goal:10, minChars:30, faction:'all', reward:1000000 },
];

// --- LOGIQUE SERVEUR ---
app.use(express.static(__dirname));
app.get('*', (_, res) => res.sendFile(__dirname + '/index.html'));

io.on('connection', (socket) => {
    socket.emit('init', { players, quests, worldEvent, history });

    socket.on('join', ({ name, faction }) => {
        socket.playerName = name;
        if (!players[name]) {
            players[name] = {
                name, faction, bounty:0, influence:0, gradeXP:0, gradeIdx:0,
                grade: FACTION_GRADES[faction]?.[0] || 'Inconnu',
                inventory: [], skills: { intelligence: 0, force: 0 },
                questProgress: {} // Stockage de la progression { questId: currentCount }
            };
            saveDB();
        }
        io.emit('player-list', players);
        socket.emit('player-data', players[name]);
    });

    socket.on('rp-message', ({ user, text, channel }) => {
        const msg = { user, text, channel: channel || 'rp', ts: Date.now() };
        history.push(msg);
        if (history.length > 100) history.shift();
        io.emit('rp-message', msg);

        // --- ANTI-FRAUDE & TRACKING QUÊTES ---
        if (players[user] && channel === 'rp') {
            const p = players[user];
            
            quests.forEach(q => {
                // Si la quête correspond à la faction et n'est pas finie
                if ((q.faction === 'all' || q.faction === p.faction)) {
                    if (!p.questProgress[q.id]) p.questProgress[q.id] = 0;
                    
                    if (p.questProgress[q.id] < q.goal) {
                        // Vérification longueur message
                        if (text.length >= (q.minChars || 0)) {
                            p.questProgress[q.id]++;
                            
                            // Notifier le client du progrès
                            socket.emit('quest-update-progress', { 
                                questId: q.id, 
                                current: p.questProgress[q.id], 
                                goal: q.goal 
                            });

                            // Validation automatique si but atteint
                            if (p.questProgress[q.id] >= q.goal) {
                                p.bounty += q.reward;
                                io.emit('system-message', `🏆 ${user} a terminé : ${q.title} !`);
                                saveDB();
                            }
                        }
                    }
                }
            });
            
            // Gain d'XP passif par message
            p.gradeXP += 5;
            checkGrade(user);
            socket.emit('player-data', p);
        }
    });

    socket.on('admin-auth', (code, cb) => {
        if (code === MASTER_CODE) return cb({ level: 'master' });
        if (code === ADMIN_CODE) return cb({ level: 'admin' });
        cb(false);
    });

    // ... (Autres fonctions admin identiques, n'oublie pas d'ajouter saveDB() après les modifs)
});

function checkGrade(name) {
    const p = players[name];
    const thresholds = [0, 50, 150, 350, 700, 1200, 2000];
    const nextXP = thresholds[p.gradeIdx + 1];
    if (nextXP && p.gradeXP >= nextXP) {
        p.gradeIdx++;
        p.grade = FACTION_GRADES[p.faction][p.gradeIdx];
        io.emit('system-message', `🎊 Promotion : ${name} est maintenant ${p.grade} !`);
        saveDB();
    }
}

server.listen(3000);
