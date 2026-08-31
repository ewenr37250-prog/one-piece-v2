class DevilFruitService {
  constructor() {
    this.fruits = new Map();
    this.catalog = [
      'Gomu Gomu no Mi',
      'Mera Mera no Mi',
      'Yami Yami no Mi',
      'Soru Soru no Mi',
      'Mori Mori no Mi',
      'Hie Hie no Mi',
      'Magu Magu no Mi',
      'Kilo Kilo no Mi'
    ];
  }

  registerFruit(data = {}) {
    const fruitName = data.name || data.id;
    const existing = [...this.fruits.values()].find((fruit) => fruit.name === fruitName || fruit.id === data.id);
    if (existing) {
      throw new Error(`Le fruit '${fruitName}' est déjà enregistré`);
    }

    const fruit = {
      id: data.id || `fruit_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name: fruitName,
      type: data.type || 'Paramecia',
      family: data.family || 'standard',
      rarity: data.rarity || 'commun',
      unique: data.unique !== false,
      state: data.state || 'available',
      ownerId: data.ownerId || null,
      location: data.location || 'inconnu',
      mastery: data.mastery || 0,
      awakened: data.awakened || false,
      history: data.history || [],
      description: data.description || ''
    };

    this.fruits.set(fruit.id, fruit);
    return fruit;
  }

  getFruitById(id) {
    return this.fruits.get(id) || null;
  }

  getAvailableFruit(name) {
    for (const fruit of this.fruits.values()) {
      if (fruit.name === name && fruit.state === 'available') {
        return fruit;
      }
    }
    return null;
  }

  listAvailableFruits() {
    return [...this.fruits.values()].filter((fruit) => fruit.state === 'available');
  }

  consumeFruit(playerId, fruitIdOrName) {
    const fruit = this.getFruitById(fruitIdOrName) || this.getAvailableFruit(fruitIdOrName) || [...this.fruits.values()].find((entry) => entry.name === fruitIdOrName);
    if (!fruit) {
      throw new Error('Fruit introuvable');
    }

    if (fruit.state === 'consumed' && fruit.ownerId !== playerId) {
      throw new Error(`Le fruit '${fruit.name}' est déjà consommé`);
    }

    fruit.state = 'consumed';
    fruit.ownerId = playerId;
    fruit.history.push({ type: 'consumed', playerId, at: new Date().toISOString() });
    return fruit;
  }

  generateRandomFruit({ excludedNames = [] } = {}) {
    const allRegisteredNames = [...this.fruits.values()].map((fruit) => fruit.name);
    const available = this.listAvailableFruits().filter((fruit) => !excludedNames.includes(fruit.name));
    const pool = available.length > 0 ? available : this.catalog
      .filter((name) => !excludedNames.includes(name) && !allRegisteredNames.includes(name))
      .map((name, index) => ({
        id: `generated_${Date.now()}_${index}`,
        name,
        type: ['Paramecia', 'Zoan', 'Logia'][index % 3],
        rarity: ['commun', 'rare', 'très rare', 'légendaire', 'mythique'][index % 5],
        unique: true,
        state: 'available'
      }));

    if (!pool.length) {
      return null;
    }

    const candidate = pool[Math.floor(Math.random() * pool.length)];
    const existingByName = [...this.fruits.values()].find((fruit) => fruit.name === candidate.name);
    if (!existingByName) {
      this.registerFruit(candidate);
    }

    return this.getAvailableFruit(candidate.name);
  }
}

module.exports = { DevilFruitService };
