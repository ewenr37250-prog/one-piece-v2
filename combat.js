'use strict';
const { Player, CombatLog } = require('./models');

const sanitize = (p) => {
  const o = p.toObject();
  delete o.passwordHash; delete o.sessionToken; delete o.__v;
  return o;
};

const checkArrest = async (p) => {
  if (!['pirate', 'revolutionnaire'].includes(p.faction) && !p.isTraitor) return false;
  if (p.wantedLevel >= 2 || p.isTraitor) {
    p.isJailed = true;
    p.jailUntil = new Date(Date.now() + 30_000);
    p.wantedLevel = 0;
    p.stats.arrested++;
    await p.save();
    return true;
  }
  return false;
};

const checkRelease = async (p) => {
  if (p.isJailed && p.jailUntil && Date.now() >= p.jailUntil) {
    p.isJailed = false;
    p.jailUntil = null;
    await p.save();
    return true;
  }
  return false;
};

const resolve = async (atkName, defName) => {
  const atk = await Player.findOne({ name: atkName });
  const def = await Player.findOne({ name: defName });

  if (!atk || !def) throw new Error('Cible introuvable');
  
  const getPower = (p) => (Math.log10(Math.max((p.bounty || 0) + (p.berries || 0), 100)) * 45) + (p.gradeIndex * 15) + (p.xp * 0.001) + (Math.random() * 20);

  const aPwr = getPower(atk);
  const dPwr = getPower(def);
  const winner = aPwr > dPwr ? atk : def;
  const loser = winner === atk ? def : atk;

  const bGain = Math.floor(loser.bounty * 0.05);
  const brGain = Math.floor(loser.berries * 0.05);

  winner.bounty += bGain; winner.berries += brGain; winner.xp += 50; winner.stats.combatWins++;
  loser.bounty = Math.max(0, loser.bounty - bGain); loser.berries = Math.max(0, loser.berries - brGain); loser.stats.combatLosses++;

  winner.refreshGrade(); loser.refreshGrade();
  await winner.save(); await loser.save();

  const narrative = [`⚔️ **${winner.name}** a terrassé **${loser.name}** !` ];
  await CombatLog.create({ attacker: atkName, defender: defName, winner: winner.name, atkPower: aPwr, defPower: dPwr, bountyGained: bGain, narrative });

  return { winner: winner.name, loser: loser.name, winnerData: sanitize(winner), loserData: sanitize(loser), gains: { bounty: bGain, berries: brGain, xp: 50 }, narrative };
};

module.exports = { resolve, sanitize, checkArrest, checkRelease };
