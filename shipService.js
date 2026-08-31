class ShipService {
  constructor(worldEngine) {
    this.worldEngine = worldEngine;
    this.ships = new Map();
  }

  createShip(data = {}) {
    const startPosition = data.startPosition || { x: 0, y: 0 };
    const ship = {
      id: data.id || `ship_${Date.now()}`,
      name: data.name || 'Navire inconnu',
      type: data.type || 'brigantine',
      ownerId: data.ownerId || null,
      crewId: data.crewId || null,
      startPosition,
      currentPosition: data.currentPosition || { ...startPosition },
      route: data.route || [],
      speed: data.speed || 10,
      maxSpeed: data.maxSpeed || 16,
      durability: data.durability || 100,
      maxDurability: data.maxDurability || 100,
      condition: data.condition || 'stable',
      cargo: data.cargo || [],
      destination: data.destination || null,
      heading: data.heading || 0,
      travelStartedAt: data.travelStartedAt || Date.now(),
      eta: data.eta || null,
      state: data.state || 'docked'
    };

    this.ships.set(ship.id, ship);
    return ship;
  }

  getCurrentPosition(ship) {
    if (!ship || !ship.route || ship.route.length < 2) {
      return ship?.currentPosition || { x: 0, y: 0 };
    }

    const start = ship.route[0] || { x: 0, y: 0 };
    const end = ship.route[1] || start;
    const elapsedMs = Math.max(0, Date.now() - (ship.travelStartedAt || Date.now()));
    const distance = Math.hypot(end.x - start.x, end.y - start.y) || 1;
    const totalMs = Math.max(1, (distance / Math.max(1, ship.speed)) * 1000);
    const progress = Math.min(1, elapsedMs / totalMs);

    const x = start.x + (end.x - start.x) * progress;
    const y = start.y + (end.y - start.y) * progress;

    ship.currentPosition = { x, y };
    ship.heading = Math.atan2(end.y - start.y, end.x - start.x);
    return { x, y };
  }
}

module.exports = { ShipService };
