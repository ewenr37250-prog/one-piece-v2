'use strict';
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const GRADES = {
  pirate: [
    { label: 'Mousse',           threshold: 0           },
    { label: 'Pirate',           threshold: 5_000       },
    { label: 'Pirate Notoire',   threshold: 50_000      },
    { label: 'Supernova',        threshold: 300_000     },
    { label: 'Capitaine',        threshold: 1_000_000   },
    { label: 'Shichibukai',      threshold: 10_000_000  },
    { label: 'Yonko',            threshold: 100_000_000 },
  ],
  marine: [
    { label: 'Matelot',          threshold: 0           },
    { label: 'Enseigne',         threshold: 10_000      },
    { label: 'Lieutenant',       threshold: 50_000      },
    { label: 'Capitaine',        threshold: 200_000     },
    { label: 'Commodore',        threshold: 500_000     },
    { label: 'Vice-Amiral',      threshold: 2_000_000   },
    { label: 'Amiral',           threshold: 10_000_000  },
  ],
  revolutionnaire: [
    { label: 'Recrue',           threshold: 0           },
    { label: 'Soldat de l\'Est', threshold: 25_000      },
    { label: 'Officier',         threshold: 150_000     },
    { label: 'Cadre',            threshold: 800_000     },
    { label: 'Commandant',       threshold: 5_000_000   },
    { label: 'Chef d\'État-Major', threshold: 50_000_000 },
  ],
  secret: [
    { label: 'Agent Secret',           threshold: 0 },
    { label: 'Amiral de la Flotte',    threshold: 0 },
    { label: 'Imu-Sama',               threshold: 0 },
  ],
};

function computeGrade(faction, stat, adminLevel) {
  const list = GRADES[faction] || GRADES.pirate;
  if (faction === 'secret') {
    const idx = adminLevel >= 3 ? 2 : (adminLevel >= 2 ? 1 : 0);
    return { grade: list[idx].label, gradeIndex: idx, grades: list };
  }
  let idx = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    if (stat >= list[i].threshold) { idx = i; break; }
  }
  return { grade: list[idx].label, gradeIndex: idx, grades: list };
}

const playerSchema = new mongoose.Schema({
  name:         { type: String, required: true, unique: true, trim: true },
  passwordHash: { type: String, required: true },
  faction:      { type: String, enum: ['pirate','marine','revolutionnaire','secret'], default: 'pirate' },
  bounty:       { type: Number, default: 0,    min: 0 },
  berries:      { type: Number, default: 5000, min: 0 },
  grade:        { type: String, default: 'Mousse' },
  gradeIndex:   { type: Number, default: 0 },
  xp:           { type: Number, default: 0 },
  adminLevel:   { type: Number, default: 0 },
  isJailed:     { type: Boolean, default: false },
  jailUntil:    { type: Date,    default: null  },
  wantedLevel:  { type: Number, default: 0, min: 0, max: 3 },
  isBanned:     { type: Boolean, default: false },
  isMuted:      { type: Boolean, default: false },
  isTraitor:    { type: Boolean, default: false },
  traitorUntil: { type: Date,    default: null  },
  sessionToken: { type: String,  default: null  },
  stats: {
    trainCount:   { type: Number, default: 0 },
    pillageCount: { type: Number, default: 0 },
    navCount:     { type: Number, default: 0 },
    combatWins:   { type: Number, default: 0 },
    combatLosses: { type: Number, default: 0 },
    arrested:     { type: Number, default: 0 },
  },
  lastSeen: { type: Date, default: Date.now },
}, { timestamps: true });

playerSchema.methods.checkPassword = function (plain) { return bcrypt.compare(plain, this.passwordHash); };
playerSchema.methods.refreshGrade = function () {
  const stat = this.faction === 'marine' ? this.berries : this.bounty;
  const result = computeGrade(this.faction, stat, this.adminLevel);
  this.grade = result.grade;
  this.gradeIndex = result.gradeIndex;
};

module.exports = {
  Player: mongoose.model('Player', playerSchema),
  CombatLog: mongoose.model('CombatLog', new mongoose.Schema({
    attacker: String, defender: String, winner: String,
    atkPower: Number, defPower: Number, bountyGained: Number, narrative: [String]
  }, { timestamps: true })),
  Message: mongoose.model('Message', new mongoose.Schema({
    author: String, faction: String, text: String, channel: String, isSystem: Boolean
  }, { timestamps: true })),
  GRADES, computeGrade
};
