const express = require('express');
const { WorldEngine, DEFAULT_ISLANDS } = require('../worldEngine');
const { ProgressionService } = require('../progressionService');

function createGameRoutes({ playerService }) {
  const router = express.Router();
  const world = new WorldEngine(DEFAULT_ISLANDS);

  router.get('/api/status', (req, res) => {
    res.json({
      status: 'online',
      playersOnline: playerService.listPlayers().length,
      world: {
        islands: DEFAULT_ISLANDS.length,
        climate: 'calm'
      }
    });
  });

  router.get('/api/player/:username', (req, res) => {
    const player = playerService.getPlayerByUsername(req.params.username);
    if (!player) {
      return res.status(404).json({ error: 'Joueur introuvable' });
    }
    return res.json(player.toPublicJSON ? player.toPublicJSON() : player);
  });

  router.post('/api/player/login', (req, res) => {
    const { username, faction = 'civil', classType = faction || 'civil' } = req.body || {};
    if (!username) {
      return res.status(400).json({ error: 'Nom d’utilisateur requis' });
    }

    let player = playerService.getPlayerByUsername(username);
    const resolvedClass = ['pirate', 'marine', 'civil'].includes(String(classType || faction || 'civil').toLowerCase())
      ? String(classType || faction || 'civil').toLowerCase()
      : 'civil';

    if (!player) {
      player = playerService.createPlayer({
        id: `player_${Date.now()}`,
        username,
        faction: resolvedClass,
        classType: resolvedClass,
        current_island: 'windmill',
        money: 100,
        stats: {
          strength: 10,
          agility: 10,
          defense: 10,
          haki: 0
        }
      });
    } else if (!player.classType) {
      player.classType = resolvedClass;
      player.faction = resolvedClass;
    }

    return res.json({ success: true, player });
  });

  router.post('/api/navigate', (req, res) => {
    const { username, target_island } = req.body || {};
    const player = playerService.getPlayerByUsername(username);
    if (!player) {
      return res.status(404).json({ error: 'Joueur introuvable' });
    }

    if (!target_island || !world.getIsland(target_island)) {
      return res.status(400).json({ error: 'Cible introuvable' });
    }

    const route = world.getRouteData(player.current_island || 'windmill', target_island);
    player.current_island = target_island;
    player.xp = ProgressionService.awardXp(player.xp, 50);
    player.level = ProgressionService.getLevelFromXp(player.xp);

    return res.json({ success: true, route, player });
  });

  router.get('/api/player/:username/inventory', (req, res) => {
    const player = playerService.getPlayerByUsername(req.params.username);
    if (!player) {
      return res.status(404).json({ error: 'Joueur introuvable' });
    }

    return res.json({
      inventory: player.inventory || [],
      equipment: player.equipment || {},
      player: player.toPublicJSON ? player.toPublicJSON() : player
    });
  });

  router.post('/api/player/:username/inventory/add', (req, res) => {
    const player = playerService.getPlayerByUsername(req.params.username);
    if (!player) {
      return res.status(404).json({ error: 'Joueur introuvable' });
    }

    const item = req.body?.item || req.body;
    const added = player.addItem(item);
    return res.json({ success: true, item: added, inventory: player.inventory, equipment: player.equipment });
  });

  router.post('/api/player/:username/inventory/equip', (req, res) => {
    const player = playerService.getPlayerByUsername(req.params.username);
    if (!player) {
      return res.status(404).json({ error: 'Joueur introuvable' });
    }

    const { slot, itemId } = req.body || {};
    if (!slot || !itemId) {
      return res.status(400).json({ error: 'slot et itemId requis' });
    }

    const equipment = player.equipItem(slot, itemId);
    return res.json({ success: true, equipment, inventory: player.inventory });
  });

  router.post('/api/player/:username/inventory/unequip', (req, res) => {
    const player = playerService.getPlayerByUsername(req.params.username);
    if (!player) {
      return res.status(404).json({ error: 'Joueur introuvable' });
    }

    const { slot } = req.body || {};
    const equipment = player.unequipItem(slot);
    return res.json({ success: true, equipment, inventory: player.inventory });
  });

  router.post('/api/combat', (req, res) => {
    const { username, enemyName, enemyPower = 100, enemyReward = 0 } = req.body || {};
    const player = playerService.getPlayerByUsername(username);
    if (!player) {
      return res.status(404).json({ error: 'Joueur introuvable' });
    }

    const normalizedEnemyPower = Number(enemyPower || 0);
    const normalizedEnemyReward = Number(enemyReward || 0);
    const playerPower = (player.stats?.strength || 10) + player.level * 2;
    const victory = playerPower >= normalizedEnemyPower;
    const reward = victory ? normalizedEnemyReward : 0;
    let lootItem = null;

    if (victory) {
      const possibleLoot = [
        { id: `loot_${Date.now()}_sword`, name: 'Épée de tempête', slot: 'weapon', rarity: 'rare', type: 'arme' },
        { id: `loot_${Date.now()}_coat`, name: 'Veste du marin', slot: 'armor', rarity: 'rare', type: 'armure' },
        { id: `loot_${Date.now()}_fruit`, name: 'Fruit étrange', slot: 'consumable', rarity: 'rare', type: 'consommable' }
      ];
      lootItem = possibleLoot[Math.floor(Math.random() * possibleLoot.length)];
      player.addItem(lootItem);
    }

    player.money = (player.money || 0) + reward;
    player.xp = ProgressionService.awardXp(player.xp, victory ? 100 : 25);
    player.level = ProgressionService.getLevelFromXp(player.xp);

    return res.json({
      success: true,
      message: victory ? `Victoire contre ${enemyName || 'ennemi'}` : `Défaite contre ${enemyName || 'ennemi'}`,
      loot: reward,
      lootItem,
      current_money: player.money,
      player
    });
  });

  return router;
}

module.exports = { createGameRoutes };
