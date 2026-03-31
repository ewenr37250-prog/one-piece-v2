function computePower(p) {
  if (!p) return 0;
  const base = Math.log10(Math.max(p.bounty, 1000)) * 50;
  const force = (p.skills?.force || 0) * 10;
  const haki = (p.haki?.observation || 0) + (p.haki?.armement || 0);
  return Math.floor(base + force + (haki * 20));
}

module.exports = { computePower };
