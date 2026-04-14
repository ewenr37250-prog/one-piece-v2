'use strict';
module.exports = {
  sanitize: (p) => {
    if (!p) return null;
    const o = p.toObject ? p.toObject() : JSON.parse(JSON.stringify(p));
    delete o.passwordHash; delete o.sessionToken; delete o.__v;
    return o;
  },
  checkArrest: async (p) => {
    if (p.wantedLevel >= 3 || p.isTraitor) {
      const chance = Math.random() * 100;
      if (chance < 40) { // 40% de chance de prison si Wanted 3 ou Traître
        p.isJailed = true;
        p.jailUntil = new Date(Date.now() + 180000); // 3 minutes
        p.wantedLevel = 0;
        return true;
      }
    }
    return false;
  }
};
