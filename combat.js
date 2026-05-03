function resolveCombat(attacker, defender) {
    // Logique de calcul basée sur l'XP et le hasard
    const chance = Math.random();
    const win = chance > 0.5;
    return {
        win,
        xpGain: win ? 150 : 20,
        bountyGain: win ? 1000 : 0
    };
}
module.exports = { resolveCombat };
