class CrewService {
  constructor() {
    this.crews = new Map();
  }

  createCrew({ id, name, captainId, flag = 'pirate', treasury = 0 } = {}) {
    if (!id || !name || !captainId) {
      throw new Error('Informations d’équipage incomplètes');
    }

    const crew = {
      id,
      name,
      flag,
      captainId,
      members: [captainId],
      ranks: { captain: [captainId] },
      reputation: 0,
      treasury,
      shipId: null,
      alliances: [],
      territories: [],
      createdAt: new Date().toISOString()
    };

    this.crews.set(id, crew);
    return crew;
  }

  addMember(crewId, memberId, role = 'membre') {
    const crew = this.crews.get(crewId);
    if (!crew) throw new Error('Équipage introuvable');
    if (!crew.members.includes(memberId)) {
      crew.members.push(memberId);
    }
    const normalizedRole = String(role).trim() || 'membre';
    crew.ranks[normalizedRole] = crew.ranks[normalizedRole] || [];
    if (!crew.ranks[normalizedRole].includes(memberId)) {
      crew.ranks[normalizedRole].push(memberId);
    }
    return crew;
  }

  removeMember(crewId, memberId) {
    const crew = this.crews.get(crewId);
    if (!crew) throw new Error('Équipage introuvable');
    crew.members = crew.members.filter((id) => id !== memberId);
    Object.keys(crew.ranks).forEach((role) => {
      crew.ranks[role] = (crew.ranks[role] || []).filter((id) => id !== memberId);
    });
    return crew;
  }
}

module.exports = { CrewService };
