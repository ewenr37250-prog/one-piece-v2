const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    faction: { type: String, default: 'Pirate' },
    role: { type: String, default: 'Joueur' }, // Joueur, Grand Corsaire, Modo Principal
    adminLevel: { type: Number, default: 0 },   // 0, 1, 2
    
    // Économie
    berrys: { type: Number, default: 1000 },
    bounty: { type: Number, default: 0 },
    
    // Stats
    puissance: { type: Number, default: 10 },
    haki: { type: Number, default: 0 },
    hp: { type: Number, default: 100 },
    stamina: { type: Number, default: 100 },
    
    // Localisation
    currentIsland: { type: String, default: 'Fuchsia Village' },
    isJailed: { type: Boolean, default: false } // Pour Impel Down
});

module.exports = mongoose.model('User', UserSchema);
