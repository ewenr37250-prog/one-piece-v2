const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  faction: { type: String, enum: ['pirate', 'marine', 'revo'], required: true },
  berries: { type: Number, default: 1000 },
  bounty: { type: Number, default: 0 },
  grade: { type: String, default: 'Mousse' },
  xp: { type: Number, default: 0 },
  fruit: {
    id: String,
    name: { type: String, default: 'Aucun' },
    power: { type: Number, default: 1.0 }
  },
  haki: {
    observation: { type: Number, default: 0 },
    armement: { type: Number, default: 0 },
    rois: { type: Number, default: 0 }
  },
  skills: {
    force: { type: Number, default: 0 },
    maitrise: { type: Number, default: 0 },
    intelligence: { type: Number, default: 0 }
  },
  inventory: Array,
  lastQuest: { type: Date, default: 0 }
});

const MarketItemSchema = new mongoose.Schema({
  itemId: String,
  name: String,
  type: String,
  basePrice: Number,
  currentPrice: Number,
  power: Number,
  stock: { type: Number, default: -1 },
  unique: { type: Boolean, default: false },
  available: { type: Boolean, default: true },
  lastPriceUpdate: Date
});

const QuestSchema = new mongoose.Schema({
  title: String,
  rewardBerries: Number,
  rewardBounty: Number,
  active: { type: Boolean, default: true }
});

const PonyglyphSchema = new mongoose.Schema({
  location: String,
  content: String,
  active: { type: Boolean, default: false }
});

module.exports = {
  Player: mongoose.model('Player', PlayerSchema),
  MarketItem: mongoose.model('MarketItem', MarketItemSchema),
  Quest: mongoose.model('Quest', QuestSchema),
  Ponyglyph: mongoose.model('Ponyglyph', PonyglyphSchema)
};
