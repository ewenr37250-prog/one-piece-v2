// combat.js
function resolveCombat(attacker, defender) {
  if (!attacker || !defender) {
    throw new Error('Combattants invalides pour le duel');
  }

  const attackPower = Number(attacker.stats?.strength || attacker.strength || 10) + Number(attacker.level || 1) * 3;
  const defensePower = Number(defender.stats?.defense || defender.defense || 10) + Number(defender.level || 1) * 3;

  const roll = Math.random() * 20;
  const totalScore = attackPower + roll;

  const isVictory = totalScore >= defensePower;
  const damageDealt = Math.abs(Math.round(totalScore - defensePower));

  return {
    winner: isVictory ? (attacker.name || attacker.username || 'Attaquant') : (defender.name || defender.username || 'Défenseur'),
    loser: isVictory ? (defender.name || defender.username || 'Défenseur') : (attacker.name || attacker.username || 'Attaquant'),
    damageDealt: Math.max(1, damageDealt),
    success: true,
    state: 'resolved'
  };
}

module.exports = { resolveCombat };
