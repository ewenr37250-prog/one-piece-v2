'use strict';
const { Player, CombatLog } = require('./models');

const RNG_FACTOR  = 0.30;
const GRADE_BONUS = 0.09;
const XP_FACTOR   = 0.0008;
const ARREST_CHANCE     = 0.22;
const ARREST_BOUNTY_MIN = 8_000_000;

// ── Puissance d'un joueur ─────────────────────────────────
function power(p) {
  const base  = Math.log10(Math.max((p.bounty || 0) + (p.berries || 0), 100)) * 45;
  const grade = base * ((p.gradeIndex || 0) * GRADE_BONUS);
  const xp    = (p.xp || 0) * XP_FACTOR;
  const rng   = Math.random() * base * RNG_FACTOR;
  return Math.max(1, base + grade + xp + rng);
}

// ── Narration combat ──────────────────────────────────────
const MOVES = {
  pirate: ['un coup de sabre dévastateur','le Gomu Gomu no Pistol','une volée de coups fulgurants','un rush sans pitié','le légendaire coup des Trois Sabres'],
  marine: ['la Justice Absolue','le Haki d\'Armement','une manœuvre tactique parfaite','le coup réglementaire','la technique secrète des Amiraux'],
  secret: ['une technique interdite','l\'Art du Gouvernement Mondial','une attaque imperceptible','la méthode classifiée','le pouvoir des Cinq Doyens'],
};

function narrate(atk, def, atkP, defP, atkWins) {
  const move = arr => arr[Math.floor(Math.random() * arr.length)];
  const atkMoves = MOVES[atk.faction] || MOVES.pirate;
  const defMoves = MOVES[def.faction] || MOVES.pirate;
  return [
    `⚔️ **${atk.name}** [${atk.grade}] affronte **${def.name}** [${def.grade}]`,
    `💥 ${atk.name} déchaîne ${move(atkMoves)}...`,
    `🛡️ ${def.name} répond avec ${move(defMoves)} !`,
    `📊 Force ATK: ${Math.floor(atkP)} | DEF: ${Math.floor(defP)}`,
    atkWins
      ? `🏆 **${atk.name}** l'emporte ! ${def.name} est défait.`
      : `💀 **${def.name}** résiste et contre-attaque ! ${atk.name} est vaincu.`,
  ];
}

// ── Résolution combat ─────────────────────────────────────
async function resolve(attackerName, defenderName) {
  const [atk, def] = await Promise.all([
    Player.findOne({ name: attackerName }),
    Player.findOne({ name: defenderName }),
  ]);
  if (!atk)          throw new Error('Attaquant introuvable');
  if (!def)          throw new Error(`Joueur "${defenderName}" introuvable`);
  if (atk.isJailed)  throw new Error('Vous êtes en prison !');
  if (def.isJailed)  throw new Error(`${def.name} est en prison`);
  if (atk.isBanned || def.isBanned) throw new Error('Combat impossible');

  const atkP   = power(atk);
  const defP   = power(def);
  const atkWins = atkP > defP;
  const winner = atkWins ? atk : def;
  const loser  = atkWins ? def : atk;

  const bountyGain  = Math.floor((loser.bounty  || 0) * 0.08);
  const berriesGain = Math.floor((loser.berries || 0) * 0.04);
  const xpWin       = 60 + (loser.gradeIndex || 0) * 25;
  const xpLose      = 12;

  winner.bounty  = Math.max(0, (winner.bounty  || 0) + bountyGain);
  winner.berries = Math.max(0, (winner.berries || 0) + berriesGain);
  winner.xp      = (winner.xp || 0) + xpWin;
  winner.stats.combatWins = (winner.stats.combatWins || 0) + 1;

  loser.bounty  = Math.max(0, (loser.bounty  || 0) - Math.floor(bountyGain * 0.4));
  loser.xp      = (loser.xp || 0) + xpLose;
  loser.stats.combatLosses = (loser.stats.combatLosses || 0) + 1;

  winner.refreshGrade();
  loser.refreshGrade();

  const narrative = narrate(atk, def, atkP, defP, atkWins);

  await Promise.all([winner.save(), loser.save()]);
  await CombatLog.create({
    attacker: attackerName, defender: defenderName,
    winner: winner.name, atkPower: atkP, defPower: defP,
    bountyGained: bountyGain, narrative,
  });

  return {
    winner: winner.name, loser: loser.name,
    atkP, defP, atkWins, narrative,
    gains:    { bounty: bountyGain, berries: berriesGain, xp: xpWin },
    winnerData: sanitize(winner),
    loserData:  sanitize(loser),
  };
}

// ── Prison ────────────────────────────────────────────────
async function checkArrest(player) {
  if (player.faction !== 'pirate') return false;
  if ((player.bounty || 0) < ARREST_BOUNTY_MIN) return false;
  if ((player.wantedLevel || 0) < 2) return false;
  if (Math.random() > ARREST_CHANCE) return false;

  player.isJailed  = true;
  player.jailUntil = new Date(Date.now() + 30_000);
  player.stats.arrested = (player.stats.arrested || 0) + 1;
  await player.save();
  return true;
}

async function checkRelease(player) {
  if (!player.isJailed) return false;
  if (player.jailUntil && new Date() >= player.jailUntil) {
    player.isJailed  = false;
    player.jailUntil = null;
    await player.save();
    return true;
  }
  return false;
}

function sanitize(p) {
  if (!p) return null;
  const o = p.toObject ? p.toObject() : { ...p };
  delete o.passwordHash;
  delete o.sessionToken;
  delete o.__v;
  return o;
}

module.exports = { power, resolve, checkArrest, checkRelease, sanitize };
