class WorldEngine {
  constructor(islands = []) {
    this.islands = new Map();
    this.loadIslands(islands);
  }

  loadIslands(islands) {
    islands.forEach((island) => {
      this.islands.set(island.id, {
        ...island,
        position: island.position || { x: 0, y: 0 },
        dangerLevel: island.dangerLevel || 0,
        climate: island.climate || 'calm',
        faction: island.faction || 'civil',
        ports: island.ports || [],
        shops: island.shops || []
      });
    });
  }

  getIsland(id) {
    return this.islands.get(id) || null;
  }

  getRouteData(fromId, toId, options = {}) {
    const from = this.getIsland(fromId);
    const to = this.getIsland(toId);
    if (!from || !to) {
      throw new Error('Île introuvable pour le calcul de route');
    }

    const dx = to.position.x - from.position.x;
    const dy = to.position.y - from.position.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const windModifier = Number(options.windModifier || 1);
    const currentModifier = Number(options.currentModifier || 1);
    const baseSpeed = 12;
    const effectiveSpeed = Math.max(1, baseSpeed * windModifier * currentModifier);
    const etaMinutes = Math.max(1, Math.ceil(distance / effectiveSpeed));

    return {
      fromId,
      toId,
      distance,
      speed: baseSpeed,
      effectiveSpeed,
      etaMinutes,
      waypoints: [from, to]
    };
  }
}

const DEFAULT_ISLANDS = [
  {
    id: 'windmill',
    name: 'Village de la Girouette',
    position: { x: 80, y: 480 },
    faction: 'civil',
    climate: 'calm',
    dangerLevel: 1,
    ports: ['port_windmill'],
    shops: ['taverne', 'marchand'],
    locations: [{ id: 'wv-taverne', name: "Taverne de Makino" }]
  },
  {
    id: 'loguetown',
    name: 'Loguetown',
    position: { x: 245, y: 560 },
    faction: 'civil',
    climate: 'calm',
    dangerLevel: 2,
    ports: ['port_loguetown'],
    shops: ['armurerie', 'marché'],
    locations: [{ id: 'lt-armu', name: "Marché des Épées" }]
  }
];

module.exports = { WorldEngine, DEFAULT_ISLANDS };
