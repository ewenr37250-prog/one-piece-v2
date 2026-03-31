require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

// Import des modules (doivent être au même niveau que server.js)
const { Player } = require('./models');
const { computePower } = require('./combat');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Connexion MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("⚓ Connecté à la base de données");
  })
  .catch(err => console.error("❌ Erreur DB:", err));

app.use(express.static('public'));

io.on('connection', (socket) => {
  socket.on('join', async ({ name, faction }) => {
    try {
      let player = await Player.findOne({ name });
      if (!player) {
        player = new Player({ 
          name, 
          faction, 
          berries: 1000, 
          bounty: 1000,
          haki: { observation: 0, armement: 0, rois: 0 },
          skills: { force: 0, maitrise: 0 }
        });
        await player.save();
      }
      socket.playerName = name;
      update(socket);
    } catch (e) {
      console.error("Erreur socket join:", e);
    }
  });

  socket.on('send-msg', (data) => {
    io.emit('receive-msg', { user: socket.playerName || "Anonyme", text: data.text });
  });
});

async function update(socket) {
  const p = await Player.findOne({ name: socket.playerName });
  if (p) {
    const power = computePower(p);
    socket.emit('update-all', { player: p, power });
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Serveur lancé sur le port ${PORT}`));
