class ShipwreckService {
  constructor() {
    this.events = [];
  }

  evaluateShipwreck({ zone = 'East Blue', ship, player, weather, faction = 'civil', reputation = 0, bounty = 0, islandProximity = 0, shipCondition = 100 }) {
    const baseRisk = 0.2 + (ship?.durability ? (1 - ship.durability / 100) : 0) + (weather?.dangerModifier || 0.1);
    const regionPenalty = zone === 'New World' ? 0.25 : zone === 'Grand Line' ? 0.15 : 0;
    const factionBonus = faction === 'pirate' ? 0.15 : 0;
    const reputationModifier = reputation > 1000 ? -0.1 : reputation > 500 ? -0.05 : 0;
    const bountyPenalty = bounty > 500 ? 0.1 : 0;
    const islandSafety = islandProximity > 0.7 ? -0.15 : 0;

    const risk = Math.max(0.05, Math.min(0.95, baseRisk + regionPenalty + factionBonus + bountyPenalty + reputationModifier + islandSafety));

    let outcome = 'survie';
    if (risk > 0.7) {
      outcome = 'naufrage';
    } else if (risk > 0.45) {
      outcome = 'déroutage';
    }

    const event = {
      id: `wreck_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      zone,
      ship,
      player,
      weather,
      faction,
      reputation,
      bounty,
      shipCondition,
      risk,
      outcome,
      createdAt: new Date().toISOString(),
      choices: outcome === 'naufrage'
        ? ['Pêcheur', 'Marine', 'Pirate', 'Marchand', 'PNJ hostile']
        : ['Restez à flot', 'Contactez la côte', 'Cherchez un refuge']
    };

    this.events.push(event);
    return event;
  }
}

module.exports = { ShipwreckService };
