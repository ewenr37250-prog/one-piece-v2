// playerService.js
const Player = require('./models');

class PlayerService {
  constructor() {
    this.players = new Map();
    this.usedDestinies = new Set();
  }

  createPlayer(data) {
    const player = new Player(data);
    const normalizedUsername = String(player.username || '').trim();

    if (!normalizedUsername) {
      throw new Error('Nom d’utilisateur requis');
    }

    if (this.players.has(player.id)) {
      throw new Error(`Le joueur '${player.id}' existe déjà`);
    }

    if (this.getPlayerByUsername(normalizedUsername)) {
      throw new Error(`Le joueur '${normalizedUsername}' existe déjà`);
    }

    if (player.destiny) {
      if (this.usedDestinies.has(player.destiny)) {
        throw new Error(`Le destin '${player.destiny}' est déjà attribué`);
      }
      this.usedDestinies.add(player.destiny);
    }

    this.players.set(player.id, player);
    return player;
  }

  getPlayer(id) {
    const player = this.players.get(id);
    if (!player) {
      throw new Error('Joueur introuvable');
    }
    return player;
  }

  getPlayerByUsername(username) {
    if (!username) return null;
    const normalized = String(username).trim().toLowerCase();
    for (const player of this.players.values()) {
      if ((player.username || '').trim().toLowerCase() === normalized) {
        return player;
      }
    }
    return null;
  }

  listPlayers() {
    return [...this.players.values()];
  }

  isDestinyTaken(destiny) {
    return Boolean(destiny && this.usedDestinies.has(destiny));
  }
}

module.exports = { PlayerService };
