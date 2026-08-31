class NPCService {
  constructor() {
    this.npcs = new Map();
  }

  normalizeFaction(value) {
    const raw = String(value || 'civil').trim();
    const lowered = raw.toLowerCase();

    if (['pirate', 'pirates', 'pirat'].includes(lowered)) return 'pirates';
    if (['marine', 'marines'].includes(lowered)) return 'marine';
    if (['civil', 'civils', 'citizen', 'citizens'].includes(lowered)) return 'civil';
    return lowered || 'civil';
  }

  createNPC({ id, name, type = 'civil', faction = 'civil', zone = 'East Blue', position = { x: 0, y: 0 }, level = 1, behavior = 'passive', dialogue = [], state = 'alive', classQuest = {} } = {}) {
    if (!id || !name) {
      throw new Error('Informations NPC incomplètes');
    }

    const normalizedFaction = this.normalizeFaction(faction);
    const npc = {
      id,
      name,
      type,
      faction: normalizedFaction,
      zone,
      position,
      level,
      behavior,
      dialogue: Array.isArray(dialogue) ? dialogue : [dialogue].filter(Boolean),
      classQuest: Object.entries(classQuest || {}).reduce((acc, [key, value]) => {
        acc[this.normalizeClass(key)] = value;
        return acc;
      }, {}),
      state,
      createdAt: new Date().toISOString()
    };

    this.npcs.set(id, npc);
    return npc;
  }

  getNPC(id) {
    return this.npcs.get(id) || null;
  }

  normalizeClass(value) {
    const raw = String(value || 'civil').trim().toLowerCase();
    if (['pirate', 'pirates', 'pirat'].includes(raw)) return 'pirate';
    if (['marine', 'marines'].includes(raw)) return 'marine';
    return 'civil';
  }

  getDialogue(id, playerFaction = 'civil') {
    const npc = this.getNPC(id);
    if (!npc) {
      throw new Error('NPC introuvable');
    }

    const normalizedPlayerFaction = this.normalizeFaction(playerFaction);
    const normalizedNpcFaction = this.normalizeFaction(npc.faction);
    const defaultDialogue = Array.isArray(npc.dialogue) && npc.dialogue.length > 0 ? npc.dialogue : ['Je ne négocie qu’avec les honnêtes.'];

    if (normalizedPlayerFaction === normalizedNpcFaction) {
      return defaultDialogue[0];
    }

    return `«${defaultDialogue[0]}»\nLe regard du ${npc.name} se fixe sur votre faction.`;
  }

  replyToMessage(id, message = '', playerClass = 'civil') {
    const npc = this.getNPC(id);
    if (!npc) {
      throw new Error('NPC introuvable');
    }

    const normalizedClass = this.normalizeClass(playerClass);
    const fallbackQuest = npc.classQuest?.[normalizedClass] || 'Reste concentré sur la quête initiale et écoute les instructions du capitaine.';
    const intro = Array.isArray(npc.dialogue) && npc.dialogue.length > 0 ? npc.dialogue[0] : 'Le voyage commence ici.';
    const prompt = String(message || '').trim();

    return {
      npcId: npc.id,
      message: `${intro} ${npc.name} répond : "${prompt ? 'Tu cherches une piste, alors écoute-moi.' : 'Tu es sur la bonne voie.'} ${fallbackQuest}"`,
      questStep: fallbackQuest,
      attitude: 'guided'
    };
  }

  reactToFaction(id, playerFaction) {
    const npc = this.getNPC(id);
    if (!npc) {
      throw new Error('NPC introuvable');
    }

    const normalizedPlayerFaction = this.normalizeFaction(playerFaction);
    const normalizedNpcFaction = this.normalizeFaction(npc.faction);

    if (normalizedPlayerFaction === normalizedNpcFaction) {
      return { attitude: 'friendly', message: `${npc.name} vous accueille comme un allié.` };
    }

    return { attitude: 'cautious', message: `${npc.name} garde une distance prudente.` };
  }
}

module.exports = { NPCService };
