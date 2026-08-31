// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const { PlayerService } = require('./playerService');
const { MarketManager } = require('./marketManager');
const { StaffService } = require('./staffService');
const { resolveCombat } = require('./combat');
const { createGameRoutes } = require('./routes/gameRoutes');
const { ProgressionService } = require('./progressionService');
const { WorldEngine, DEFAULT_ISLANDS } = require('./worldEngine');
const { WeatherService } = require('./weatherService');
const { ShipService } = require('./shipService');
const { DevilFruitService } = require('./devilFruitService');
const { EventService } = require('./eventService');
const { WorldStateService } = require('./worldStateService');
const { ModerationService } = require('./moderationService');
const { CrewService } = require('./crewService');
const { FactionService } = require('./factionService');
const { NPCService } = require('./npcService');
const { PersistenceService } = require('./storageService');
const { AuthService } = require('./authService');
const { QuestService } = require('./questService');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token requis' });
  }

  try {
    const payload = authService.verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token invalide' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Token requis' });
  }

  if (req.user.role === 'admin') {
    return next();
  }

  const effectiveUser = moderationService.getStaffByIdentifier(req.user.username || req.user.id || req.user.userId);
  if (effectiveUser && (effectiveUser.role === 'OWNER' || effectiveUser.role === 'SUPER_MOD' || moderationService.can(req.user.username, '*'))) {
    return next();
  }

  return res.status(403).json({ error: 'Accès administrateur requis' });
}

const playerService = new PlayerService();
const marketManager = new MarketManager();
const staffService = new StaffService();
const worldEngine = new WorldEngine(DEFAULT_ISLANDS);
const weatherService = new WeatherService();
const shipService = new ShipService(worldEngine);
const devilFruitService = new DevilFruitService();
const eventService = new EventService();
const worldStateService = new WorldStateService();
const moderationService = new ModerationService();
const crewService = new CrewService();
const factionService = new FactionService();
const npcService = new NPCService();
const persistenceService = new PersistenceService({ filePath: './data/game-state.json', createDir: true });
const questService = new QuestService();
const authService = new AuthService({
  jwtSecret: process.env.JWT_SECRET || 'grandline_v3_ultimate_secret_2026',
  adminPin: process.env.ADMIN_PIN || '7777'
});

function ensurePlayerForUser(username, { faction = 'civil', classType = null } = {}) {
  const safeUsername = String(username || '').trim();
  if (!safeUsername) {
    throw new Error('Nom d’utilisateur requis');
  }

  let player = playerService.getPlayerByUsername(safeUsername);
  const resolvedClass = ['pirate', 'marine', 'civil'].includes(String(classType || faction || 'civil').toLowerCase())
    ? String(classType || faction || 'civil').toLowerCase()
    : 'civil';

  if (!player) {
    player = playerService.createPlayer({
      id: `player_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      username: safeUsername,
      name: safeUsername,
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

    const startingFruit = devilFruitService.generateRandomFruit();
    if (startingFruit) {
      player.setDevilFruit(startingFruit);
    }
  } else if (!player.classType) {
    player.classType = resolvedClass;
    player.faction = resolvedClass;
  }

  return player;
}

staffService.addOwner({
  id: 'admin_owner',
  username: 'GrandLineMaster'
});

moderationService.addStaff({ id: 'admin_owner', username: 'GrandLineMaster', role: 'OWNER' });
worldStateService.registerInstitution('Corsaires', 'ACTIVE');
worldStateService.registerFaction('Pirates', { status: 'active' });
worldStateService.registerFaction('Marine', { status: 'active' });
worldStateService.registerFaction('Civils', { status: 'active' });

factionService.addFaction({ id: 'pirates', name: 'Pirates', type: 'pirate' });
factionService.addFaction({ id: 'marine', name: 'Marine', type: 'marine' });
factionService.addFaction({ id: 'civils', name: 'Civils', type: 'civil' });
factionService.syncFromWorldState(worldStateService);

crewService.createCrew({ id: 'crew_default', name: 'Mugiwara', captainId: 'JoueurPublic', flag: 'pirate', treasury: 250 });

npcService.createNPC({
  id: 'npc_01',
  name: 'Marchand',
  type: 'guide',
  faction: 'civil',
  zone: 'East Blue',
  dialogue: ['Le voyage commence ici, capitaine.'],
  classQuest: {
    pirate: 'Va au port et parle au contrebandier pour la première piste.',
    marine: 'Contrôle la route côtière et vérifie la présence des trafiquants.',
    civil: 'Aide les marchands et sécurise les échanges du quartier.'
  }
});
npcService.createNPC({
  id: 'npc_02',
  name: 'Marine',
  type: 'guide',
  faction: 'marine',
  zone: 'East Blue',
  dialogue: ['La loi garde la route, et la route garde les hommes.'],
  classQuest: {
    pirate: 'Reste discret si tu veux obtenir une faveur de la Marine.',
    marine: 'Rends la route sûre et calme les tensions de l’île.',
    civil: 'Soutiens les habitants et rapporte tout comportement suspect.'
  }
});

devilFruitService.registerFruit({ id: 'fruit_mera', name: 'Mera Mera no Mi', type: 'Logia', rarity: 'légendaire', unique: true, state: 'available' });
devilFruitService.registerFruit({ id: 'fruit_gomu', name: 'Gomu Gomu no Mi', type: 'Paramecia', rarity: 'légendaire', unique: true, state: 'available' });

const startingEvent = eventService.createEvent({
  id: 'event_world_001',
  title: 'La Bataille au Sommet',
  description: 'Grand événement mondial en cours',
  location: 'Marineford',
  type: 'historique',
  status: 'active'
});

worldStateService.registerTerritory('windmill', { status: 'neutral', faction: 'civil', influence: { civil: 10, pirates: 0, marine: 0 } });
worldStateService.registerTerritory('loguetown', { status: 'neutral', faction: 'civil', influence: { civil: 12, pirates: 3, marine: 2 } });
worldStateService.registerTerritory('marineford', { status: 'controlled', faction: 'marine', owner: 'Marine', influence: { marine: 20, pirates: 5, civil: 2 } });
worldStateService.addMajorEvent({
  id: startingEvent.id,
  title: startingEvent.title,
  status: startingEvent.status,
  description: startingEvent.description,
  location: startingEvent.location,
  consequences: []
});

questService.registerQuest({
  id: 'quest_001',
  title: 'Traque du trafiquant',
  description: 'Contrôler le trafic dans la route de Loguetown.',
  objective: 'defeat_bandit',
  reward: 180,
  reputationGain: 25,
  faction: 'pirates'
});

questService.registerQuest({
  id: 'quest_002',
  title: 'Patrouille de la Marine',
  description: 'Renforcer la présence militaire sur les routes côtières.',
  objective: 'patrol',
  reward: 220,
  reputationGain: 30,
  faction: 'marine'
});

questService.registerQuest({
  id: 'quest_003',
  title: 'Échange de marchandises',
  description: 'Soutenir le commerce local et sécuriser les échangeurs.',
  objective: 'trade',
  reward: 140,
  reputationGain: 15,
  faction: 'civil'
});

const defaultPlayer = playerService.createPlayer({
  id: 'JoueurPublic',
  username: 'JoueurPublic',
  name: 'JoueurPublic',
  faction: 'civil',
  current_island: 'windmill',
  money: 100,
  stats: {
    strength: 12,
    agility: 11,
    defense: 10,
    haki: 0
  }
});

(async () => {
  const loaded = await persistenceService.load();
  if (loaded && Array.isArray(loaded.players) && loaded.players.length > 0) {
    for (const savedPlayer of loaded.players) {
      try {
        if (!playerService.getPlayerByUsername(savedPlayer.username)) {
          playerService.createPlayer(savedPlayer);
        }
      } catch (error) {
        console.warn('Erreur de chargement joueur persisté :', error.message);
      }
    }
  }

  if (loaded && loaded.world) {
    if (loaded.world.era) {
      worldStateService.state.era = loaded.world.era;
    }
    if (loaded.world.institutions) {
      for (const [name, state] of Object.entries(loaded.world.institutions)) {
        worldStateService.registerInstitution(name, state);
      }
    }
    if (loaded.world.factions) {
      for (const [name, state] of Object.entries(loaded.world.factions)) {
        worldStateService.registerFaction(name, state);
      }
    }
  }
})();

app.use(createGameRoutes({ playerService }));

app.get('/api/quests', (req, res) => {
  res.json({ quests: [...questService.quests.values()] });
});

app.get('/api/quests/:playerId', (req, res) => {
  const playerId = req.params.playerId;
  res.json({
    active: questService.getActiveQuests(playerId),
    reputations: Object.fromEntries(questService.factionReputation.get(playerId) || new Map())
  });
});

app.post('/api/quests/:playerId/assign', (req, res) => {
  try {
    const { questId } = req.body || {};
    const assigned = questService.assignQuest(req.params.playerId, questId);
    res.json({ success: true, assigned });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/quests/:playerId/complete', (req, res) => {
  try {
    const { questId } = req.body || {};
    const result = questService.completeQuest(req.params.playerId, questId);
    res.json({ success: true, result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/system/persist', async (req, res) => {
  try {
    const payload = {
      players: [...playerService.players.values()].map(player => player.toPublicJSON ? player.toPublicJSON() : player),
      world: {
        era: worldStateService.state.era,
        institutions: Object.fromEntries(worldStateService.state.institutions),
        factions: Object.fromEntries(worldStateService.state.factions),
        territories: Object.fromEntries(worldStateService.state.territories),
        history: worldStateService.state.history
      },
      updatedAt: new Date().toISOString()
    };

    await persistenceService.save(payload);
    res.json({ success: true, savedAt: payload.updatedAt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/system/load', async (req, res) => {
  try {
    const data = await persistenceService.load();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/world/map', (req, res) => {
  res.json({
    islands: DEFAULT_ISLANDS,
    weather: weatherService.getRouteModifiers('East Blue'),
    world: {
      regions: ['East Blue', 'Grand Line', 'New World'],
      activeEvent: eventService.getBannerData()
    }
  });
});

app.get('/api/world/banner', (req, res) => {
  const banner = eventService.getBannerData();
  res.json({ banner });
});

app.get('/api/world/events', (req, res) => {
  res.json({
    events: [...eventService.events.values()].slice(0, 10)
  });
});

app.post('/api/world/events/resolve', (req, res) => {
  const { eventId, factionId = 'civil', territoryId = null, deltaInfluence = 0, summary = 'Impact mondial' } = req.body || {};

  if (!eventId) {
    return res.status(400).json({ error: 'eventId requis' });
  }

  try {
    const consequence = worldStateService.resolveWorldEvent(eventId, { factionId, territoryId, deltaInfluence, summary });
    factionService.syncFromWorldState(worldStateService);
    return res.json({ success: true, consequence });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.get('/api/world/state', (req, res) => {
  res.json({
    era: worldStateService.state.era,
    institutions: Object.fromEntries(worldStateService.state.institutions),
    factions: Object.fromEntries(worldStateService.state.factions),
    territories: Object.fromEntries(worldStateService.state.territories),
    history: worldStateService.state.history
  });
});

app.get('/api/world/summary', (req, res) => {
  factionService.syncFromWorldState(worldStateService);

  const factions = [...factionService.factions.values()].map((faction) => ({
    id: faction.id,
    name: faction.name,
    type: faction.type,
    reputation: Number(faction.reputation || 0),
    influence: worldStateService.state.factions.get(faction.name)?.influence || {}
  }));

  const territories = [...worldStateService.state.territories.values()].map((territory) => ({
    id: territory.id,
    name: territory.name,
    status: territory.status,
    owner: territory.owner,
    faction: territory.faction,
    influence: territory.influence || {}
  }));

  res.json({
    era: worldStateService.state.era,
    activeEvent: eventService.getBannerData(),
    factions,
    territories
  });
});

app.get('/api/admin/logs', requireAuth, requireAdmin, (req, res) => {
  res.json({
    logs: moderationService.listLogs().slice(-10).reverse()
  });
});

app.get('/api/world/territories', (req, res) => {
  res.json({
    territories: [...worldStateService.state.territories.values()]
  });
});

app.post('/api/world/territories/claim', (req, res) => {
  const { username, territoryId, faction = 'civil' } = req.body || {};
  const player = playerService.getPlayerByUsername(username);

  if (!player) {
    return res.status(404).json({ error: 'Joueur introuvable' });
  }

  if (!territoryId) {
    return res.status(400).json({ error: 'territoryId requis' });
  }

  const territory = worldStateService.claimTerritory(territoryId, {
    owner: username,
    faction: faction || player.faction || 'civil',
    controller: player.id
  });

  return res.json({ success: true, territory });
});

app.get('/api/world/factions', (req, res) => {
  factionService.syncFromWorldState(worldStateService);
  res.json({ factions: [...factionService.factions.values()] });
});

app.get('/api/world/npcs', (req, res) => {
  res.json({ npcs: [...npcService.npcs.values()] });
});

app.get('/api/market/listings', (req, res) => {
  res.json({ listings: marketManager.listListings() });
});

app.post('/api/market/listings', (req, res) => {
  try {
    const { sellerId, itemId, item, price, quantity = 1 } = req.body || {};
    const seller = playerService.getPlayerByUsername(sellerId) || playerService.getPlayer(sellerId);
    const listing = marketManager.createListing({
      sellerId: seller.id,
      itemId,
      item,
      price,
      quantity,
      seller
    });

    return res.json({ success: true, listing });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post('/api/market/listings/:id/buy', (req, res) => {
  try {
    const { buyerId, username } = req.body || {};
    const buyer = playerService.getPlayerByUsername(username || buyerId) || playerService.getPlayer(buyerId);
    const listing = marketManager.listListings().find((entry) => entry.id === req.params.id);
    if (!listing) {
      return res.status(404).json({ error: 'Cette offre n’existe plus' });
    }

    const seller = playerService.getPlayer(listing.sellerId) || playerService.getPlayerByUsername(listing.sellerId);
    const transaction = marketManager.buyListing(buyer, req.params.id, seller);
    return res.json({ success: true, transaction });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post('/api/world/npcs/interact', (req, res) => {
  const { npcId, playerFaction = 'civil', message = 'Je veux une mission.' } = req.body || {};
  const npc = npcService.getNPC(npcId);

  if (!npc) {
    return res.status(404).json({ error: 'NPC introuvable' });
  }

  const reaction = npcService.reactToFaction(npcId, playerFaction);
  const dialogue = npcService.getDialogue(npcId, playerFaction);
  const reply = npcService.replyToMessage(npcId, message, playerFaction);

  return res.json({
    success: true,
    npc,
    reaction,
    dialogue,
    reply
  });
});

app.post('/api/auth/register', (req, res) => {
  try {
    const { username, password, classType = 'civil' } = req.body || {};
    const user = authService.registerUser({ username, password });
    const player = ensurePlayerForUser(username, { faction: classType, classType });
    res.json({
      success: true,
      user,
      player: player.toPublicJSON ? player.toPublicJSON() : player
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password, classType = 'civil' } = req.body || {};
    const session = authService.loginUser({ username, password });
    const player = ensurePlayerForUser(username, { faction: classType, classType });
    res.json({
      success: true,
      session: { ...session, token: session.token, user: session.user },
      player: player.toPublicJSON ? player.toPublicJSON() : player
    });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

app.post('/api/auth/admin/login', (req, res) => {
  try {
    const { username, pin } = req.body || {};
    const session = authService.loginAdmin({ username, pin });
    res.json({ success: true, session: { ...session, token: session.token, user: session.user } });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

app.post('/api/admin/event/create', requireAuth, requireAdmin, (req, res) => {
  const { actorId, title, location, description, type } = req.body || {};
  const actor = actorId || req.user?.username || 'admin';
  if (!moderationService.can(actor, 'events.manage')) {
    return res.status(403).json({ error: 'Permissions insuffisantes' });
  }

  const event = eventService.createEvent({
    id: `event_${Date.now()}`,
    title,
    description,
    location,
    type: type || 'historique',
    status: 'active'
  });

  moderationService.log({
    actorId: actor,
    action: 'event.create',
    targetId: event.id,
    reason: 'Création d’un événement mondial'
  });

  return res.json({ success: true, event });
});

app.post('/api/admin/staff/create', requireAuth, requireAdmin, (req, res) => {
  const { actorId, targetId, username, role } = req.body || {};
  const actor = actorId || req.user?.username || 'admin';
  if (!moderationService.can(actor, 'staff.manage')) {
    return res.status(403).json({ error: 'Permissions insuffisantes' });
  }

  const staff = moderationService.addStaff({ id: targetId || `staff_${Date.now()}`, username, role });
  res.json({ success: true, staff });
});

app.post('/api/admin/world/events/resolve', requireAuth, requireAdmin, (req, res) => {
  try {
    const { eventId, factionId = 'civil', territoryId = null, deltaInfluence = 0, summary = 'Impact mondial' } = req.body || {};
    const consequence = worldStateService.resolveWorldEvent(eventId, { factionId, territoryId, deltaInfluence, summary });
    factionService.syncFromWorldState(worldStateService);
    moderationService.log({
      actorId: req.user?.username || 'admin',
      action: 'event.resolve',
      targetId: eventId || territoryId || null,
      reason: summary
    });
    return res.json({ success: true, consequence });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post('/api/admin/world/territories/claim', requireAuth, requireAdmin, (req, res) => {
  try {
    const { territoryId, owner = 'admin', faction = 'civil', controller = 'admin' } = req.body || {};
    if (!territoryId) {
      return res.status(400).json({ error: 'territoryId requis' });
    }

    const territory = worldStateService.claimTerritory(territoryId, { owner, faction, controller });
    moderationService.log({
      actorId: req.user?.username || 'admin',
      action: 'territory.claim',
      targetId: territoryId,
      reason: `${owner} prend le contrôle de ${territoryId}`
    });

    return res.json({ success: true, territory });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

io.on('connection', (socket) => {
  console.log(`Joueur connecté : ${socket.id}`);

  socket.on('player:login', (data, callback) => {
    try {
      let player;
      const username = data?.username || data?.name || `Voyageur_${socket.id.slice(0, 4)}`;
      try {
        player = playerService.getPlayerByUsername(username) || playerService.getPlayer(data.id);
      } catch (err) {
        const destiny = data?.destiny || null;
        if (destiny && playerService.isDestinyTaken(destiny)) {
          throw new Error(`Le destin '${destiny}' est déjà attribué`);
        }

        player = playerService.createPlayer({
          id: data?.id || `player_${Date.now()}`,
          username,
          name: username,
          faction: data?.faction || 'civil',
          current_island: 'windmill',
          money: 100,
          destiny,
          stats: {
            strength: 10,
            agility: 10,
            defense: 10,
            haki: 0
          }
        });
      }

      socket.data.playerId = player.id;
      callback({ success: true, player: player.toPublicJSON ? player.toPublicJSON() : player });
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });

  socket.on('combat:duel', ({ targetId }, callback) => {
    try {
      const attacker = playerService.getPlayer(socket.data.playerId || defaultPlayer.id);
      const defender = playerService.getPlayer(targetId || defaultPlayer.id);
      const battleResult = resolveCombat(attacker, defender);
      ProgressionService.gainSkillXp(attacker, 'epee', 15);
      ProgressionService.gainSkillXp(defender, 'combat', 5);
      io.emit('combat:result', battleResult);
      callback({ success: true, battleResult });
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });

  socket.on('market:create', ({ itemId, price, quantity }, callback) => {
    try {
      const player = playerService.getPlayer(socket.data.playerId || defaultPlayer.id);
      const listing = marketManager.createListing({
        sellerId: player.id,
        itemId,
        price,
        quantity,
        seller: player
      });
      io.emit('market:update', marketManager.listListings());
      callback({ success: true, listing });
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });

  socket.on('market:buy', ({ listingId }, callback) => {
    try {
      const buyer = playerService.getPlayer(socket.data.playerId || defaultPlayer.id);
      const listing = marketManager.listListings().find((entry) => entry.id === listingId);
      if (!listing) {
        throw new Error('Cette offre n’existe plus');
      }

      const seller = playerService.getPlayer(listing.sellerId) || playerService.getPlayerByUsername(listing.sellerId);
      const transaction = marketManager.buyListing(buyer, listingId, seller);
      io.emit('market:update', marketManager.listListings());
      callback({ success: true, transaction });
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Joueur déconnecté : ${socket.id}`);
  });
});

const DEFAULT_PORT = Number(process.env.PORT) || 3000;

function startServer(port = DEFAULT_PORT) {
  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      console.warn(`Port ${port} occupé, tentative sur le port ${nextPort}...`);
      startServer(nextPort);
      return;
    }

    throw error;
  });

  server.listen(port, () => {
    console.log(`Serveur prêt sur le port ${port}`);
  });
}

startServer();
