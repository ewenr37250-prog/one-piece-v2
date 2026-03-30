require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const CODES = { master: "TartifletteDeLaHess", super: "RedaLeGoat" };

let players = {};
let world = {
    journal: "L'ère des pirates V3 est lancée !",
    market: { wood: 100, steel: 500, fluctuation: 1.0 },
    onePiece: false
};

const GRADES = {
    pirate: ['Mousse','Matelot','Second','Capitaine','Commodore','Empereur'],
    marine: ['Recrue','Soldat','Sergent','Colonel','Vice-Amiral','Amiral en Chef'],
    revo:   ['Initié','Agent','Cadre','Commandant','Chef de corps','Chef Suprême']
};

app.use(express.static(__dirname));

// --- ALGORITHME DE PUISSANCE V3 ---
function calculatePower(p) {
    let base = (p.bounty / 5000) + (p.gradeIdx * 200);
    let fruitBonus = p.fruit.active ? (p.skills.fruitMastery * p.fruit.coeff * 25) : 0;
    let hakiBonus = (p.haki.obs * 50) + (p.haki.arm * 100) + (p.haki.kings * 500);
    let skillBonus = (p.skills.force * 20) + (p.skills.intel * 10);
    return Math.floor(base + fruitBonus + hakiBonus + skillBonus);
}

io.on('connection', (socket) => {
    socket.on('join', ({ name, faction }) => {
        socket.join('global');
        socket.join(faction);
        
        if (!players[name]) {
            players[name] = {
                name, faction, bounty: 1000, gradeIdx: 0, xp: 0,
                grade: GRADES[faction][0],
                fruit: { active: false, name: "Aucun", coeff: 1.0 },
                haki: { obs: 0, arm: 0, kings: 0 },
                skills: { force: 0, stealth: 0, fruitMastery: 0, intel: 0, canRead: false },
                lastQuest: 0, power: 0
            };
        }
        socket.playerName = name;
        update();
    });

    // SYSTÈME DE CHAT (GLOBAL + PRIVÉ)
    socket.on('send-msg', ({ text, type }) => {
        const p = players[socket.playerName];
        if(!p) return;
        const msg = { user: p.name, text, faction: p.faction, type };

        if (type === 'global') {
            io.to('global').emit('receive-msg', msg);
        } else {
            io.to(p.faction).emit('receive-msg', msg);
        }
    });

    socket.on('quest', () => {
        const p = players[socket.playerName];
        if(!p || Date.now() - p.lastQuest < 45000) return socket.emit('err', "Attendez...");
        p.xp += 60; p.bounty += 5000; p.lastQuest = Date.now();
        if(p.xp >= 300 && p.gradeIdx < 5) { p.gradeIdx++; p.xp = 0; p.grade = GRADES[p.faction][p.gradeIdx]; }
        update();
    });

    socket.on('upgrade-skill', (skill) => {
        const p = players[socket.playerName];
        if(p && p.xp >= 100) { 
            p.xp -= 100; p.skills[skill]++; 
            if(p.skills.intel >= 10) p.canRead = true;
            update(); 
        }
    });

    socket.on('admin-action', ({ code, action, data }) => {
        if(code !== CODES.master && code !== CODES.super) return;
        const t = players[data.target];
        if (action === "give-fruit" && t) t.fruit = { active: true, name: data.name, coeff: parseFloat(data.coeff) };
        if (action === "give-haki" && t) t.haki[data.type]++;
        if (action === "set-journal") world.journal = data.text;
        update();
    });

    function update() {
        if(players[socket.playerName]) players[socket.playerName].power = calculatePower(players[socket.playerName]);
        io.emit('update-all', { players, world });
    }
});

server.listen(process.env.PORT || 3000, () => console.log("⚓ Serveur V3 Actif"));
