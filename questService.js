class QuestService {
  constructor() {
    this.quests = new Map();
    this.questState = new Map();
    this.factionReputation = new Map();
  }

  registerQuest({
    id,
    title,
    description,
    objective,
    reward = 0,
    reputationGain = 0,
    faction = 'civil'
  } = {}) {
    if (!id || !title) {
      throw new Error('Quête incomplète');
    }

    const quest = {
      id,
      title,
      description,
      objective,
      reward,
      reputationGain,
      faction,
      createdAt: new Date().toISOString()
    };

    this.quests.set(id, quest);
    return quest;
  }

  assignQuest(playerId, questId) {
    const quest = this.quests.get(questId);
    if (!quest) {
      throw new Error('Quête introuvable');
    }

    const state = this.questState.get(playerId) || {};
    if (state[questId]) {
      return state[questId];
    }

    const assigned = {
      id: quest.id,
      questId: quest.id,
      playerId,
      title: quest.title,
      description: quest.description,
      objective: quest.objective,
      status: 'active',
      reward: quest.reward,
      reputationGain: quest.reputationGain,
      faction: quest.faction,
      assignedAt: new Date().toISOString()
    };

    state[questId] = assigned;
    this.questState.set(playerId, state);
    return assigned;
  }

  getActiveQuests(playerId) {
    const state = this.questState.get(playerId) || {};
    return Object.values(state).filter((quest) => quest.status === 'active');
  }

  completeQuest(playerId, questId) {
    const state = this.questState.get(playerId) || {};
    const quest = state[questId];
    if (!quest) {
      throw new Error('Quête non assignée');
    }

    quest.status = 'completed';
    quest.completedAt = new Date().toISOString();
    delete state[questId];
    this.questState.set(playerId, state);

    const reputation = this.factionReputation.get(playerId) || new Map();
    const current = reputation.get(quest.faction) || 0;
    reputation.set(quest.faction, current + (quest.reputationGain || 0));
    this.factionReputation.set(playerId, reputation);

    return {
      id: quest.id,
      questId: quest.questId,
      title: quest.title,
      reward: quest.reward,
      reputationGain: quest.reputationGain,
      faction: quest.faction,
      completedAt: quest.completedAt
    };
  }

  getReputation(playerId, faction) {
    const reputation = this.factionReputation.get(playerId) || new Map();
    return reputation.get(faction) || 0;
  }
}

module.exports = { QuestService };
