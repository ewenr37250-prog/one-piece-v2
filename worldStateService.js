class WorldStateService {
  constructor() {
    this.state = {
      era: 'Grand Line',
      institutions: new Map(),
      factions: new Map(),
      territories: new Map(),
      majorEvents: [],
      history: []
    };
  }

  normalizeFactionKey(factionId) {
    const normalized = String(factionId || 'civil').trim().toLowerCase();
    if (normalized === 'pirate' || normalized === 'pirates') return 'pirates';
    if (normalized === 'marine' || normalized === 'marines') return 'marine';
    if (normalized === 'civil' || normalized === 'civils' || normalized === 'citizen' || normalized === 'citizens') return 'civils';
    return normalized || 'civils';
  }

  normalizeFactionName(factionId) {
    const normalized = this.normalizeFactionKey(factionId);
    if (normalized === 'pirates') return 'Pirates';
    if (normalized === 'marine') return 'Marine';
    if (normalized === 'civils') return 'Civils';
    return String(factionId || 'Civils').trim() || 'Civils';
  }

  registerInstitution(name, value) {
    this.state.institutions.set(name, value);
    return this.state.institutions.get(name);
  }

  dedupeFactionEntries() {
    const deduped = new Map();

    for (const [key, value] of this.state.factions.entries()) {
      if (!value) continue;

      const factionId = String((value.id || key || 'civil')).trim().toLowerCase();
      const canonicalKey = this.normalizeFactionKey(factionId || key || value.name || 'civil');
      const canonicalName = this.normalizeFactionName(value.name || key || factionId || 'Civils');
      const merged = deduped.get(canonicalKey) || {};

      const normalized = {
        id: canonicalKey,
        name: canonicalName,
        status: 'active',
        reputation: 0,
        influence: {},
        ...merged,
        ...value,
        id: canonicalKey,
        name: canonicalName
      };

      deduped.set(canonicalKey, normalized);
    }

    this.state.factions = deduped;
    return deduped;
  }

  registerFaction(name, value = {}) {
    const canonicalKey = this.normalizeFactionKey(name || value.id || 'civil');
    const canonicalName = this.normalizeFactionName(name || value.id || 'civil');
    const normalized = {
      id: canonicalKey,
      name: canonicalName,
      status: 'active',
      reputation: 0,
      influence: {},
      ...value,
      name: canonicalName,
      id: canonicalKey
    };

    for (const [existingKey, existingFaction] of [...this.state.factions.entries()]) {
      if (!existingFaction) continue;
      const existingId = String((existingFaction.id || existingKey || 'civil')).trim().toLowerCase();
      const existingKeyNormalized = this.normalizeFactionKey(existingId || existingKey || existingFaction.name || 'civil');
      if (existingKeyNormalized === canonicalKey || this.normalizeFactionName(existingFaction.name || existingKey || existingId || 'Civils') === canonicalName) {
        this.state.factions.delete(existingKey);
      }
    }

    this.state.factions.set(canonicalKey, normalized);
    this.dedupeFactionEntries();
    return this.state.factions.get(canonicalKey);
  }

  registerTerritory(name, value) {
    const territory = {
      id: name,
      name,
      owner: null,
      status: 'neutral',
      faction: 'civil',
      ...value
    };

    this.state.territories.set(name, territory);
    return this.state.territories.get(name);
  }

  claimTerritory(territoryId, { owner, faction = 'civil', controller = null }) {
    const existing = this.state.territories.get(territoryId) || {
      id: territoryId,
      name: territoryId,
      owner: null,
      status: 'neutral',
      faction: 'civil'
    };

    const territory = {
      ...existing,
      id: territoryId,
      name: existing.name || territoryId,
      owner: owner || existing.owner || null,
      faction: faction || existing.faction || 'civil',
      controller: controller || existing.controller || null,
      status: 'controlled'
    };

    this.state.territories.set(territoryId, territory);
    this.addHistory({
      type: 'territory.claim',
      territoryId,
      owner,
      faction,
      at: new Date().toISOString()
    });

    return territory;
  }

  applyFactionImpact(territoryId, factionId, delta) {
    const territory = this.state.territories.get(territoryId) || null;
    if (!territory) {
      throw new Error('Territoire introuvable');
    }

    const normalizedFactionId = String(factionId || 'civil').toLowerCase();
    const normalizedDelta = Number(delta || 0);
    const factionKey = this.normalizeFactionKey(normalizedFactionId);
    const factionLabel = this.normalizeFactionName(normalizedFactionId);

    territory.influence = {
      ...(territory.influence || {}),
      [normalizedFactionId]: Number((territory.influence && territory.influence[normalizedFactionId]) || 0) + normalizedDelta
    };

    const factionState = this.state.factions.get(factionKey) || { id: factionKey, name: factionLabel, status: 'active', reputation: 0, influence: {} };
    factionState.reputation = Number(factionState.reputation || 0) + normalizedDelta;
    factionState.influence = {
      ...(factionState.influence || {}),
      [territoryId]: Number((factionState.influence && factionState.influence[territoryId]) || 0) + normalizedDelta
    };
    this.state.factions.set(factionKey, factionState);
    this.dedupeFactionEntries();

    return territory.influence;
  }

  addHistory(entry) {
    this.state.history.push({
      at: new Date().toISOString(),
      ...entry
    });
    return this.state.history[this.state.history.length - 1];
  }

  addMajorEvent(event) {
    this.state.majorEvents.push(event);
    return event;
  }

  resolveWorldEvent(eventId, { factionId = null, territoryId = null, deltaInfluence = 0, summary = 'Impact mondial' } = {}) {
    const normalizedFactionId = String(factionId || 'civil').toLowerCase();
    const normalizedDelta = Number(deltaInfluence) || 0;
    const canonicalFactionName = this.normalizeFactionName(normalizedFactionId);

    let event = this.state.majorEvents.find((entry) => entry.id === eventId) || null;
    if (!event) {
      event = {
        id: eventId,
        title: `Événement ${eventId}`,
        status: 'resolved',
        description: summary,
        consequences: []
      };
      this.state.majorEvents.push(event);
    }

    const consequence = {
      id: `impact_${Date.now()}`,
      eventId,
      factionId: normalizedFactionId,
      territoryId,
      deltaInfluence: normalizedDelta,
      summary,
      at: new Date().toISOString()
    };

    if (territoryId) {
      const territory = this.state.territories.get(territoryId) || this.registerTerritory(territoryId, {
        status: 'neutral',
        faction: canonicalFactionName
      });

      this.applyFactionImpact(territoryId, normalizedFactionId, normalizedDelta);
      territory.status = normalizedDelta >= 0 ? 'controlled' : 'contested';
      territory.faction = canonicalFactionName;
      territory.owner = territory.owner || 'world';
    }

    if (normalizedFactionId) {
      const canonicalFactionKey = this.normalizeFactionKey(normalizedFactionId);
      this.state.factions.set(canonicalFactionKey, {
        ...(this.state.factions.get(canonicalFactionKey) || { id: canonicalFactionKey, name: canonicalFactionName, status: 'active' }),
        id: canonicalFactionKey,
        name: canonicalFactionName,
        status: 'active',
        lastInfluence: normalizedDelta,
        updatedAt: new Date().toISOString()
      });
      this.dedupeFactionEntries();
    }

    event.consequences = Array.isArray(event.consequences) ? [...event.consequences, consequence] : [consequence];
    this.addHistory({
      type: 'event.resolve',
      eventId,
      factionId: normalizedFactionId,
      territoryId,
      deltaInfluence: normalizedDelta,
      summary,
      at: consequence.at
    });

    return consequence;
  }
}

module.exports = { WorldStateService };
