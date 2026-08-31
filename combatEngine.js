class CombatEngine {
  constructor() {
    this.actions = ['attaque', 'défense', 'esquive', 'haki', 'fruit'];
  }

  resolveCombat({ attacker, defender, action = 'attaque', environment = {} } = {}) {
    if (!attacker || !defender) {
      throw new Error('Combattants invalides');
    }

    const attackerPower = this.computePower(attacker, action, environment);
    const defenderPower = this.computePower(defender, 'défense', environment);
    const score = attackerPower + (Math.random() * 20 - 10);
    const defended = defenderPower + (Math.random() * 10 - 5);

    const winner = score >= defended ? attacker : defender;
    const loser = winner === attacker ? defender : attacker;

    const result = {
      winner: winner.id,
      loser: loser.id,
      winnerName: winner.name || winner.username || 'Combattant',
      loserName: loser.name || loser.username || 'Combattant',
      action,
      damageDealt: Math.max(5, Math.round(Math.abs(score - defended))),
      log: `${winner.name || winner.username} remporte l’échange`,
      state: 'resolved'
    };

    return result;
  }

  computePower(entity, action, environment = {}) {
    const stats = entity.stats || {};
    const skills = entity.skills || {};
    const combatSkills = entity.combatSkills || {};
    const haki = entity.haki || {};
    const fruitBonus = entity.devilFruit ? 8 : 0;
    const environmentBonus = environment.weather === 'storm' ? 4 : 0;
    const base = (stats.strength || 10) * 2 + (stats.agility || 10) + (stats.defense || 10);
    const skillBoost = (skills.epee || 0) * 0.6 + (skills.tir || 0) * 0.5 + (skills.navigation || 0) * 0.2;
    const combatBoost = (combatSkills.epee || 0) * 0.8 + (combatSkills.haki || 0) * 0.9 + (combatSkills.fruit || 0) * 0.7;
    const hakiBoost = (haki.observation || 0) * 0.3 + (haki.armement || 0) * 0.4 + (haki.conquérant || 0) * 0.5;
    const actionBoost = action === 'haki' ? 12 : action === 'fruit' ? 15 : action === 'esquive' ? 8 : 0;

    return base + skillBoost + combatBoost + hakiBoost + fruitBonus + environmentBonus + actionBoost;
  }
}

module.exports = { CombatEngine };
