const test = require('node:test');
const assert = require('node:assert/strict');

const { WorldEngine, DEFAULT_ISLANDS } = require('../worldEngine');
const { ProgressionService } = require('../progressionService');
const { PlayerService } = require('../playerService');
const { DevilFruitService } = require('../devilFruitService');
const { ShipService } = require('../shipService');
const { WeatherService } = require('../weatherService');
const { ShipwreckService } = require('../shipwreckService');
const { CrewService } = require('../crewService');
const { FactionService } = require('../factionService');
const { NPCService } = require('../npcService');
const { CombatEngine } = require('../combatEngine');
const { ModerationService } = require('../moderationService');
const { EventService } = require('../eventService');
const { WorldStateService } = require('../worldStateService');
const { PersistenceService } = require('../storageService');
const { AuthService } = require('../authService');
const { QuestService } = require('../questService');
const Player = require('../models');

test('WorldEngine exposes islands and navigation data', () => {
  const world = new WorldEngine(DEFAULT_ISLANDS);
  const islandA = world.getIsland('windmill');
  const islandB = world.getIsland('loguetown');

  assert.ok(islandA);
  assert.ok(islandB);
  assert.equal(islandA.name, 'Village de la Girouette');

  const route = world.getRouteData('windmill', 'loguetown');
  assert.ok(route.distance > 0);
  assert.ok(route.etaMinutes > 0);
});

test('ProgressionService converts XP to level and skill tier', () => {
  const level = ProgressionService.getLevelFromXp(1800);
  assert.ok(level >= 3);

  const tier = ProgressionService.getSkillTier(62);
  assert.equal(tier.label, 'Expert');
});

test('PlayerService creates and retrieves players safely', () => {
  const service = new PlayerService();
  const player = service.createPlayer({ id: 'p1', username: 'Luffy', current_island: 'windmill' });

  assert.equal(player.username, 'Luffy');
  assert.equal(service.getPlayer('p1').username, 'Luffy');
  assert.equal(service.getPlayerByUsername('Luffy').id, 'p1');
});

test('ProgressionService awards XP and updates skill levels', () => {
  const player = new Player({ id: 'p2', username: 'Zoro', skills: { epee: 40 } });
  ProgressionService.gainSkillXp(player, 'epee', 30);

  assert.ok(player.skills.epee >= 40);
  assert.equal(player.level, 1);
});

test('PlayerService enforces unique destiny ownership', () => {
  const service = new PlayerService();
  const first = service.createPlayer({ id: 'p3', username: 'Sanji', destiny: 'Lecteur de Ponéglyphes' });

  assert.equal(first.destiny, 'Lecteur de Ponéglyphes');
  assert.ok(service.isDestinyTaken('Lecteur de Ponéglyphes'));

  assert.throws(() => {
    service.createPlayer({ id: 'p4', username: 'Usopp', destiny: 'Lecteur de Ponéglyphes' });
  }, /déjà attribué/);
});

test('DevilFruitService prevents duplicates and tracks ownership', () => {
  const service = new DevilFruitService();
  const fruit = service.registerFruit({
    id: 'mera',
    name: 'Mera Mera no Mi',
    type: 'Logia',
    rarity: 'légendaire',
    unique: true,
    state: 'available'
  });

  assert.equal(fruit.name, 'Mera Mera no Mi');
  assert.throws(() => {
    service.registerFruit({
      id: 'mera-double',
      name: 'Mera Mera no Mi',
      type: 'Logia',
      rarity: 'légendaire',
      unique: true,
      state: 'available'
    });
  }, /déjà/);

  const consumed = service.consumeFruit('p9', 'mera');
  assert.equal(consumed.state, 'consumed');
  assert.equal(consumed.ownerId, 'p9');
  assert.equal(service.getAvailableFruit('Mera Mera no Mi'), null);
});

test('DevilFruitService generates a unique fruit from available registry', () => {
  const service = new DevilFruitService();
  service.registerFruit({ id: 'one', name: 'Gomu Gomu no Mi', type: 'Paramecia', rarity: 'légendaire', unique: true, state: 'available' });
  service.registerFruit({ id: 'two', name: 'Mero Mero no Mi', type: 'Paramecia', rarity: 'très rare', unique: true, state: 'available' });
  service.consumeFruit('p100', 'one');

  const generated = service.generateRandomFruit({ excludedNames: ['Mero Mero no Mi'] });
  assert.ok(generated);
  assert.notEqual(generated.name, 'Mero Mero no Mi');
});

test('Player can absorb a devil fruit and unlock a combat bonus', () => {
  const player = new Player({ id: 'p_fruit', username: 'Ace', combatSkills: { epee: 12, tir: 8, main_nue: 10, mobilite: 9, haki: 6, fruit: 0 } });
  const fruit = { id: 'fruit_mera', name: 'Mera Mera no Mi', type: 'Logia', rarity: 'légendaire', unique: true, state: 'available' };

  player.setDevilFruit(fruit);

  assert.equal(player.devilFruit.name, 'Mera Mera no Mi');
  assert.ok(player.combatSkills.fruit >= 25);
  assert.equal(player.devilFruit.rarity, 'légendaire');
});

test('WorldEngine computes navigation with wind and current modifiers', () => {
  const world = new WorldEngine(DEFAULT_ISLANDS);
  const route = world.getRouteData('windmill', 'loguetown', {
    windModifier: 1.15,
    currentModifier: 0.9
  });

  assert.ok(route.distance > 0);
  assert.ok(route.effectiveSpeed > 0);
  assert.ok(route.etaMinutes > 0);
});

test('ShipService calculates ship position while travelling', () => {
  const world = new WorldEngine(DEFAULT_ISLANDS);
  const shipService = new ShipService(world);
  const ship = shipService.createShip({
    id: 'ship_1',
    name: 'Vent d’Azur',
    type: 'brigantine',
    ownerId: 'p1',
    crewId: 'c1',
    startPosition: { x: 80, y: 480 },
    route: [{ x: 80, y: 480 }, { x: 245, y: 560 }],
    speed: 12,
    travelStartedAt: Date.now() - 60000,
    maxSpeed: 16
  });

  const position = shipService.getCurrentPosition(ship);
  assert.ok(position.x >= 80 && position.x <= 245);
  assert.ok(position.y >= 480 && position.y <= 560);
});

test('WeatherService provides regional weather and modifiers', () => {
  const weather = new WeatherService();
  const zone = weather.getZoneWeather('East Blue');
  const routeModifiers = weather.getRouteModifiers('East Blue');

  assert.ok(zone);
  assert.ok(routeModifiers.windModifier > 0);
  assert.ok(routeModifiers.currentModifier > 0);
  assert.ok(['calm', 'tailwind', 'strong_wind', 'storm', 'fog'].includes(zone.state));
});

test('ShipwreckService evaluates survivability by risk and region', () => {
  const service = new ShipwreckService();
  const weather = { dangerModifier: 0.4 };

  const event = service.evaluateShipwreck({
    zone: 'New World',
    ship: { durability: 20 },
    player: { id: 'p12', name: 'Nami' },
    weather,
    faction: 'pirate',
    reputation: 1500,
    bounty: 400,
    islandProximity: 0.2,
    shipCondition: 20
  });

  assert.ok(event.outcome === 'naufrage' || event.outcome === 'déroutage');
  assert.ok(Array.isArray(event.choices));
  assert.ok(event.risk > 0);
});

test('CrewService manages crew members and roles', () => {
  const service = new CrewService();
  const crew = service.createCrew({ id: 'crew_1', name: 'Mugiwara', captainId: 'p1' });
  service.addMember('crew_1', 'p2', 'vice-capitaine');

  assert.ok(crew.members.includes('p1'));
  assert.ok(crew.members.includes('p2'));
  assert.ok(crew.ranks['vice-capitaine'].includes('p2'));
});

test('FactionService and NPCService create world structures', () => {
  const factionService = new FactionService();
  const npcService = new NPCService();

  const faction = factionService.addFaction({ id: 'pirates', name: 'Pirates', type: 'pirate' });
  const npc = npcService.createNPC({ id: 'npc_1', name: 'Marchand', type: 'marchand', faction: 'civil' });

  assert.equal(faction.name, 'Pirates');
  assert.equal(npc.type, 'marchand');
  assert.equal(npc.faction, 'civil');
});

test('CombatEngine resolves server-side combat correctly', () => {
  const engine = new CombatEngine();
  const attacker = new Player({ id: 'a1', username: 'Luffy', stats: { strength: 16, agility: 12, defense: 11 }, skills: { epee: 50 }, combatSkills: { epee: 30, haki: 20, fruit: 40 }, haki: { observation: 10, armement: 15, conquérant: 5 }, devilFruit: true });
  const defender = new Player({ id: 'd1', username: 'Zoro', stats: { strength: 14, agility: 13, defense: 12 }, skills: { epee: 35 }, combatSkills: { epee: 25, haki: 10, fruit: 0 }, haki: { observation: 9, armement: 10, conquérant: 0 } });

  const result = engine.resolveCombat({ attacker, defender, action: 'fruit', environment: { weather: 'storm' } });
  assert.ok(result.winner === 'a1' || result.winner === 'd1');
  assert.equal(result.state, 'resolved');
  assert.ok(result.damageDealt >= 5);
});

test('ModerationService enforces hierarchy and logs actions', () => {
  const service = new ModerationService();
  service.addStaff({ id: 'owner_1', username: 'Owner', role: 'OWNER' });
  service.addStaff({ id: 'mod_1', username: 'SupMod', role: 'SUPER_MOD' });

  assert.ok(service.can('owner_1', '*'));
  assert.ok(service.can('mod_1', 'events.manage'));
  assert.equal(service.getStaffByRole('OWNER').username, 'Owner');

  const log = service.log({ actorId: 'owner_1', action: 'event.start', targetId: 'event_1', reason: 'Événement majeur' });
  assert.ok(log.action === 'event.start');
  assert.ok(service.listLogs().length >= 1);

  assert.throws(() => {
    service.addStaff({ id: 'owner_2', username: 'Owner2', role: 'OWNER' });
  }, /Un seul Owner/);
});

test('EventService and WorldStateService manage global world events', () => {
  const eventService = new EventService();
  const worldState = new WorldStateService();

  const event = eventService.createEvent({
    id: 'event_1',
    title: 'La Bataille au Sommet',
    description: 'Événement mondial',
    location: 'Marineford',
    type: 'historique',
    status: 'active'
  });

  worldState.addMajorEvent({ id: event.id, title: event.title, status: event.status });
  worldState.registerInstitution('Corsaires', 'ACTIVE');

  const banner = eventService.getBannerData();
  assert.equal(event.title, 'La Bataille au Sommet');
  assert.ok(banner.message.includes('ÉVÉNEMENT MONDIAL'));
  assert.equal(worldState.state.institutions.get('Corsaires'), 'ACTIVE');
});

test('PersistenceService saves and reloads player and world state', async () => {
  const storage = new PersistenceService({
    filePath: './tmp-persistence-test.json',
    createDir: true
  });

  const player = new Player({ id: 'persist_1', username: 'Sabo', money: 150, current_island: 'loguetown' });
  const payload = {
    players: [player.toPublicJSON()],
    world: { era: 'Grand Line', institutions: { Marine: 'ACTIVE' } },
    updatedAt: new Date().toISOString()
  };

  await storage.save(payload);
  const loaded = await storage.load();

  assert.equal(loaded.players.length, 1);
  assert.equal(loaded.players[0].username, 'Sabo');
  assert.equal(loaded.world.era, 'Grand Line');
  assert.equal(loaded.world.institutions.Marine, 'ACTIVE');

  await storage.delete();
});

test('AuthService registers users securely and verifies tokens', async () => {
  const auth = new AuthService({ jwtSecret: 'test-secret', adminPin: '7777' });
  const user = auth.registerUser({ username: 'Kaya', password: 'securepass123' });

  assert.equal(user.username, 'Kaya');
  assert.notEqual(user.passwordHash, 'securepass123');

  const session = auth.loginUser({ username: 'Kaya', password: 'securepass123' });
  assert.ok(session.token);
  assert.equal(auth.verifyToken(session.token).username, 'Kaya');

  const adminSession = auth.loginAdmin({ username: 'GrandLineMaster', pin: '7777' });
  assert.ok(adminSession.token);
  assert.equal(auth.verifyToken(adminSession.token).role, 'admin');
});

test('Player inventory and equipment management works', () => {
  const player = new Player({
    id: 'inv_1',
    username: 'Robin',
    inventory: [{ id: 'sword_1', name: 'Épée de marin', slot: 'weapon', rarity: 'rare' }],
    equipment: { weapon: null }
  });

  const added = player.addItem({ id: 'fruit_1', name: 'Fruit du démon', slot: 'consumable', rarity: 'rare' });
  const equipped = player.equipItem('weapon', 'sword_1');
  const unequipped = player.unequipItem('weapon');

  assert.equal(added.name, 'Fruit du démon');
  assert.equal(equipped.weapon, 'sword_1');
  assert.equal(unequipped.weapon, null);
  assert.equal(player.toPublicJSON().inventory.length, 2);
});

test('Combat rewards a loot item and stores it in inventory', () => {
  const player = new Player({
    id: 'loot_1',
    username: 'Sanji',
    money: 100,
    inventory: []
  });

  const item = {
    id: 'weapon_rare_1',
    name: 'Épée de tempête',
    slot: 'weapon',
    rarity: 'rare',
    type: 'arme'
  };

  player.addItem(item);

  assert.equal(player.inventory[0].name, 'Épée de tempête');
  assert.equal(player.toPublicJSON().inventory.length, 1);
});

test('World services expose faction and NPC metadata for the active world', () => {
  const factionService = new FactionService();
  const npcService = new NPCService();

  const faction = factionService.addFaction({ id: 'marine', name: 'Marine', type: 'marine' });
  const npc = npcService.createNPC({ id: 'npc_9', name: 'Vice-amiral', type: 'marine', faction: 'marine', zone: 'Marineford' });

  assert.equal(faction.name, 'Marine');
  assert.equal(npc.zone, 'Marineford');
  assert.equal(npc.faction, 'marine');
});

test('WorldStateService tracks territory control and historical claims', () => {
  const state = new WorldStateService();
  const territory = state.claimTerritory('Marineford', { owner: 'player_42', faction: 'pirates' });

  assert.equal(territory.status, 'controlled');
  assert.equal(territory.owner, 'player_42');
  assert.equal(territory.faction, 'pirates');
  assert.equal(state.state.history.at(-1).type, 'territory.claim');
});

test('FactionService changes reputation and world influence', () => {
  const factionService = new FactionService();
  const worldState = new WorldStateService();

  const faction = factionService.addFaction({ id: 'pirates', name: 'Pirates', type: 'pirate' });
  const rep = factionService.changeReputation('pirates', 25);
  const territory = worldState.registerTerritory('Marineford', { status: 'neutral', faction: 'civil' });
  const influence = worldState.applyFactionImpact('Marineford', 'pirates', 15);

  assert.equal(faction.name, 'Pirates');
  assert.equal(rep, 25);
  assert.equal(territory.name, 'Marineford');
  assert.equal(influence.pirates, 15);
});

test('FactionService keeps a single canonical entry per faction', () => {
  const service = new FactionService();
  const worldState = new WorldStateService();

  service.addFaction({ id: 'pirates', name: 'Pirates', type: 'pirate' });
  service.addFaction({ id: 'marine', name: 'Marine', type: 'marine' });
  worldState.registerFaction('Pirates', { status: 'active', reputation: 18, influence: { marineford: 6 } });
  worldState.registerFaction('Marine', { status: 'active', reputation: 8, influence: { marineford: 2 } });
  service.syncFromWorldState(worldState);

  const unique = [...service.factions.values()].filter((faction) => faction && (faction.name === 'Pirates' || faction.name === 'Marine'));
  assert.equal(unique.length, 2);
  assert.equal(service.getFaction('pirates').name, 'Pirates');
  assert.equal(service.getFaction('Pirates').id, 'pirates');
});

test('FactionService keeps a single Civils faction entry', () => {
  const service = new FactionService();
  const worldState = new WorldStateService();

  service.addFaction({ id: 'civils', name: 'Civils', type: 'civil', reputation: 5 });
  worldState.registerFaction('Civils', { status: 'active', reputation: 5, influence: { windmill: 15 } });
  worldState.registerFaction('civil', { status: 'active', reputation: 5, influence: { windmill: 15 } });
  service.syncFromWorldState(worldState);

  const civilians = [...service.factions.values()].filter((faction) => String(faction.name).trim() === 'Civils');
  assert.equal(civilians.length, 1);
  assert.equal(service.getFaction('civils').name, 'Civils');
});

test('NPCService exposes faction-aware dialogue and reactions', () => {
  const service = new NPCService();
  const npc = service.createNPC({
    id: 'npc_ally',
    name: 'Marchand',
    type: 'marchand',
    faction: 'civil',
    zone: 'Loguetown',
    dialogue: ['Bienvenue, voyageur.']
  });

  assert.equal(npc.behavior, 'passive');
  assert.equal(service.getDialogue('npc_ally', 'civil'), 'Bienvenue, voyageur.');
  assert.equal(service.reactToFaction('npc_ally', 'marine').attitude, 'cautious');
});

test('NPCService guides class-specific quest flow with AI-style replies', () => {
  const service = new NPCService();
  const npc = service.createNPC({
    id: 'npc_quest',
    name: 'Tio',
    type: 'guide',
    faction: 'civil',
    zone: 'Loguetown',
    dialogue: ['La route du capitaine commence ici.'],
    classQuest: {
      pirate: 'Va au port et parle au contrebandier.',
      marine: 'Vérifie la route côtière et informe la garnison.',
      civil: 'Aide le marché local à sécuriser les échanges.'
    }
  });

  const reply = service.replyToMessage('npc_quest', 'Je veux une mission', 'pirate');
  assert.ok(reply.message.includes('capitaine') || reply.message.includes('port'));
  assert.equal(reply.questStep, 'Va au port et parle au contrebandier.');
  assert.equal(npc.type, 'guide');
});

test('WorldStateService resolves world event consequences on factions and territories', () => {
  const state = new WorldStateService();
  state.registerTerritory('Marineford', { status: 'neutral', faction: 'civil' });
  const result = state.resolveWorldEvent('event_42', {
    factionId: 'pirates',
    territoryId: 'Marineford',
    deltaInfluence: 12,
    summary: 'La bataille a changé la sphère d’influence.'
  });

  assert.equal(result.summary, 'La bataille a changé la sphère d’influence.');
  assert.equal(state.state.territories.get('Marineford').influence.pirates, 12);
  assert.equal(state.state.history.at(-1).type, 'event.resolve');
});

test('MarketManager transfers items and money on purchase', () => {
  const { MarketManager } = require('../marketManager');
  const manager = new MarketManager();
  const seller = {
    id: 'seller_market_1',
    money: 0,
    inventory: [{ id: 'weapon_market_1', name: 'Épée de vent', slot: 'weapon', rarity: 'rare', type: 'arme', value: 40 }]
  };
  const buyer = {
    id: 'buyer_market_1',
    money: 150,
    inventory: []
  };

  const listing = manager.createListing({
    sellerId: seller.id,
    item: seller.inventory[0],
    price: 60,
    quantity: 1
  });

  const result = manager.buyListing(buyer, listing.id, seller);

  assert.equal(result.success, true);
  assert.equal(buyer.money, 90);
  assert.equal(buyer.inventory[0].name, 'Épée de vent');
  assert.equal(seller.money, 60);
  assert.equal(seller.inventory.length, 0);
});

test('QuestService tracks faction reputation and quest completion', () => {
  const service = new QuestService();
  const quest = service.registerQuest({
    id: 'quest_pirates_1',
    title: 'Traque du trafiquant',
    description: 'Intercepter un trafic de poudre sur la route de Loguetown',
    objective: 'defeat_bandit',
    reward: 180,
    reputationGain: 25,
    faction: 'pirates'
  });

  const assigned = service.assignQuest('player_42', quest.id);
  const completed = service.completeQuest('player_42', quest.id);

  assert.equal(assigned.id, 'quest_pirates_1');
  assert.equal(completed.questId, 'quest_pirates_1');
  assert.equal(completed.reward, 180);
  assert.ok(service.getReputation('player_42', 'pirates') >= 25);
  assert.equal(service.getActiveQuests('player_42').length, 0);
});
