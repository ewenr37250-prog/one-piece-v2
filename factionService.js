class FactionService {
  constructor() {
    this.factions = new Map();
  }

  findFactionByName(name) {
    if (!name) return null;
    const lookup = String(name).trim().toLowerCase();
    for (const faction of this.factions.values()) {
      if (!faction) continue;
      if (String(faction.id || '').trim().toLowerCase() === lookup) return faction;
      if (String(faction.name || '').trim().toLowerCase() === lookup) return faction;
    }
    return null;
  }

  addFaction({ id, name, type = 'civil', reputation = 0, territories = [], relationships = {}, permissions = [] } = {}) {
    if (!id || !name) {
      throw new Error('Faction incomplète');
    }

    const canonicalKey = String(id).trim().toLowerCase();
    const canonicalName = String(name).trim();
    const existing = this.factions.get(canonicalKey) || this.findFactionByName(canonicalName) || null;
    const faction = existing || {
      id: canonicalKey,
      name: canonicalName,
      type,
      reputation,
      territories,
      relationships,
      permissions,
      rank: 'standard',
      title: 'Faction',
      createdAt: new Date().toISOString()
    };

    faction.id = canonicalKey;
    faction.name = canonicalName;
    faction.type = type || faction.type || 'civil';
    faction.reputation = Number(reputation ?? faction.reputation ?? 0);
    faction.territories = Array.isArray(territories) ? territories : faction.territories || [];
    faction.relationships = { ...(faction.relationships || {}), ...(relationships || {}) };
    faction.permissions = Array.isArray(permissions) ? permissions : faction.permissions || [];
    faction.rank = faction.rank || 'standard';
    faction.title = faction.title || 'Faction';
    faction.createdAt = faction.createdAt || new Date().toISOString();

    this.factions.set(canonicalKey, faction);
    return faction;
  }

  syncFromWorldState(worldStateService) {
    const entries = worldStateService?.state?.factions ? [...worldStateService.state.factions.entries()] : [];

    for (const [name, data] of entries) {
      const rawId = String((data?.id || name || 'civil')).trim().toLowerCase();
      const normalizedId = rawId === 'civil' ? 'civils' : rawId;
      const canonicalName = String(data?.name || name || 'Civils').trim();
      const displayName = canonicalName === 'Civil' || canonicalName === 'civil' ? 'Civils' : canonicalName;
      const existing = this.factions.get(normalizedId) || this.findFactionByName(displayName) || this.findFactionByName(String(name).trim()) || null;
      const record = existing || {
        id: normalizedId,
        name: displayName,
        type: 'civil',
        reputation: 0,
        relationships: {},
        permissions: []
      };

      record.id = normalizedId;
      record.name = displayName;
      record.type = data?.type || record.type || 'civil';
      record.reputation = Number(data?.reputation ?? record.reputation ?? 0);
      record.relationships = { ...(record.relationships || {}), ...(data?.relationships || {}) };
      record.permissions = Array.isArray(data?.permissions) ? data.permissions : record.permissions || [];

      this.factions.set(normalizedId, record);
    }

    const deduped = new Map();
    for (const faction of this.factions.values()) {
      const id = String(faction?.id || '').trim().toLowerCase();
      const key = id === 'civil' ? 'civils' : id;
      if (!key) continue;
      const displayName = String(faction?.name || 'Civils').trim();
      const finalName = displayName === 'civil' || displayName === 'Civil' ? 'Civils' : displayName;
      deduped.set(key, { ...faction, id: key, name: finalName });
    }

    this.factions = deduped;
    return [...deduped.values()];
  }

  getFaction(id) {
    if (!id) return null;
    const key = String(id).trim().toLowerCase();
    if (this.factions.has(key)) {
      return this.factions.get(key);
    }

    return this.findFactionByName(id) || null;
  }

  changeReputation(id, delta) {
    const faction = this.getFaction(id);
    if (!faction) {
      throw new Error('Faction introuvable');
    }

    faction.reputation = Number(faction.reputation || 0) + Number(delta || 0);
    return faction.reputation;
  }

  setRelationship(id, targetId, value) {
    const faction = this.getFaction(id);
    if (!faction) {
      throw new Error('Faction introuvable');
    }

    faction.relationships = {
      ...(faction.relationships || {}),
      [targetId]: value
    };

    return faction.relationships;
  }
}

module.exports = { FactionService };
