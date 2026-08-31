// models.js
class Player {
  constructor(data = {}) {
    this.id = data.id;
    this.username = data.username || data.name || 'Aventurier';
    this.name = data.name || this.username;
    this.age = data.age || 16;
    this.origin = data.origin || 'Inconnu';
    this.description = data.description || 'Aventurier du Grand Line';
    this.level = data.level || 1;
    this.xp = data.xp || 0;
    this.bounty = data.bounty || 0;
    this.faction = data.faction || 'civil';
    this.classType = data.classType || data.playerClass || data.class || this.faction || 'civil';
    this.title = data.title || 'Voyageur';
    this.current_island = data.current_island || 'windmill';
    this.money = data.money || 0;
    this.stats = {
      strength: 10,
      agility: 10,
      defense: 10,
      haki: 0,
      ...data.stats
    };
    this.skills = {
      cuisine: 0,
      navigation: 0,
      cartographie: 0,
      meteorologie: 0,
      tir: 0,
      epee: 0,
      medecine: 0,
      peche: 0,
      forge: 0,
      commerce: 0,
      ...data.skills
    };
    this.combatSkills = {
      epee: 0,
      tir: 0,
      main_nue: 0,
      mobilite: 0,
      haki: 0,
      fruit: 0,
      ...(data.combatSkills || {})
    };
    this.haki = data.haki || {
      observation: 0,
      armement: 0,
      conquérant: 0
    };
    this.devilFruit = data.devilFruit || null;
    this.inventory = Array.isArray(data.inventory) ? data.inventory.map((item) => ({ ...item })) : [];
    this.equipment = {
      weapon: null,
      armor: null,
      accessory: null,
      ...data.equipment
    };
    this.crewId = data.crewId || null;
    this.status = data.status || 'libre';
    this.destiny = data.destiny || null;
  }

  setDevilFruit(fruit = null) {
    if (!fruit) {
      this.devilFruit = null;
      return null;
    }

    const fruitData = {
      id: fruit.id || `fruit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: fruit.name || fruit.id || 'Fruit inconnu',
      type: fruit.type || 'Paramecia',
      rarity: fruit.rarity || 'commun',
      unique: fruit.unique !== false,
      state: fruit.state || 'consumed',
      ownerId: fruit.ownerId || this.id || null,
      description: fruit.description || '',
      mastery: fruit.mastery || 0,
      awakened: fruit.awakened || false,
      history: Array.isArray(fruit.history) ? fruit.history : []
    };

    const rarityBonus = {
      commun: 8,
      rare: 14,
      'très rare': 20,
      légendaire: 30,
      mythique: 40
    };

    this.devilFruit = fruitData;
    this.combatSkills = {
      ...this.combatSkills,
      fruit: Math.max(Number(this.combatSkills.fruit || 0), Number(rarityBonus[fruitData.rarity] || 10))
    };
    return this.devilFruit;
  }

  addItem(item = {}) {
    if (!item || !item.id || !item.name) {
      throw new Error('Objet invalide pour l’inventaire');
    }

    const nextItem = {
      id: item.id,
      name: item.name,
      slot: item.slot || 'misc',
      rarity: item.rarity || 'commun',
      type: item.type || 'objet',
      description: item.description || '',
      value: item.value || 0
    };

    this.inventory.push(nextItem);
    return nextItem;
  }

  removeItem(itemId) {
    const index = this.inventory.findIndex((item) => item.id === itemId);
    if (index === -1) {
      return null;
    }

    const [removed] = this.inventory.splice(index, 1);
    Object.keys(this.equipment).forEach((slot) => {
      if (this.equipment[slot] === itemId) {
        this.equipment[slot] = null;
      }
    });

    return removed;
  }

  equipItem(slot, itemId) {
    const item = this.inventory.find((entry) => entry.id === itemId);
    if (!item) {
      throw new Error('Objet introuvable dans l’inventaire');
    }

    this.equipment[slot] = itemId;
    return { ...this.equipment };
  }

  unequipItem(slot) {
    this.equipment[slot] = null;
    return { ...this.equipment };
  }

  toPublicJSON() {
    return {
      id: this.id,
      username: this.username,
      name: this.name,
      level: this.level,
      xp: this.xp,
      money: this.money,
      faction: this.faction,
      classType: this.classType,
      title: this.title,
      current_island: this.current_island,
      stats: this.stats,
      skills: this.skills,
      combatSkills: this.combatSkills,
      haki: this.haki,
      devilFruit: this.devilFruit,
      bounty: this.bounty,
      destiny: this.destiny,
      status: this.status,
      inventory: this.inventory,
      equipment: this.equipment
    };
  }
}

module.exports = Player;
