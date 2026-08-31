class ProgressionService {
  static getLevelFromXp(xp = 0) {
    let total = 0;
    let level = 1;

    while (total + level * 100 <= xp) {
      total += level * 100;
      level += 1;
    }

    return level;
  }

  static getSkillTier(level = 0) {
    if (level >= 95) {
      return { label: 'Légendaire', color: '#ffd966' };
    }
    if (level >= 80) {
      return { label: 'Maître', color: '#ff8c42' };
    }
    if (level >= 60) {
      return { label: 'Expert', color: '#8ab4f8' };
    }
    if (level >= 40) {
      return { label: 'Confirmé', color: '#7ee787' };
    }
    if (level >= 20) {
      return { label: 'Apprenti', color: '#a78bfa' };
    }
    return { label: 'Novice', color: '#9aa0a6' };
  }

  static awardXp(currentXp, gainedXp) {
    return Math.max(0, (currentXp || 0) + (gainedXp || 0));
  }

  static gainSkillXp(player, skillName, xpGain = 0) {
    if (!player || !skillName) return player;
    if (!player.skills) {
      player.skills = {};
    }
    const current = Number(player.skills[skillName] || 0);
    const updated = Math.min(100, current + Number(xpGain || 0));
    player.skills[skillName] = updated;
    player.xp = ProgressionService.awardXp(player.xp, Number(xpGain || 0));
    player.level = ProgressionService.getLevelFromXp(player.xp);
    return player;
  }
}

module.exports = { ProgressionService };
