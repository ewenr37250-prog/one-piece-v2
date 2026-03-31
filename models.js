const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    faction: { type: String, default: 'Pirate' },
    role: { type: String, default: 'Joueur' }, 
    adminLevel: { type: Number, default: 0 },   // 0: Joueur, 1: Grand Corsaire, 2: Principal
    
    // Économie
    berrys: { type: Number, default: 1000 },
    bounty: { type: Number, default: 0 },
    
    // Statistiques de combat
    puissance: { type: Number, default: 10 },
    haki: { type: Number, default: 0 },
    hp: { type: Number, default: 100 },
    stamina: { type: Number, default: 100 },
    
    // Localisation et État
    currentIsland: { type: String, default: 'Fuchsia Village' },
    isJailed: { type: Boolean, default: false }
});

module.exports = mongoose.model('User', UserSchema);
