module.exports = {
    // Calcul du gain lors d'un pillage
    calculatePillage: (puissance, multiplier = 1) => {
        const baseGain = Math.floor(Math.random() * 100) + 50;
        return Math.floor((baseGain + (puissance * 2)) * multiplier);
    },

    // Gain d'entraînement
    calculateTrain: (hakiActuel) => {
        return {
            gainPuissance: Math.floor(Math.random() * 5) + 1,
            gainHaki: Math.random() > 0.9 ? 1 : 0 // 10% de chance d'up le Haki
        };
    }
};
