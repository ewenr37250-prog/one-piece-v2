const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  faction: { type: String, required: true },
  berries: { type: Number, default: 1000 },
  bounty: { type: Number, default: 1000 },
  haki: {
    observation: { type: Number, default: 0 },
    armement: { type: Number, default: 0 },
    rois: { type: Number, default: 0 }
  },
  skills: {
    force: { type: Number, default: 0 },
    maitrise: { type: Number, default: 0 }
  }
});

module.exports = { Player: mongoose.model('Player', PlayerSchema) };
