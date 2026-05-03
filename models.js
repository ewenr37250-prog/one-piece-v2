class Player {
    constructor(name, faction, isAdmin = false) {
        this.name = name;
        this.faction = faction;
        this.isAdmin = isAdmin;
        this.grade = faction === 'marine' ? 'Matelot' : 'Mousse';
        this.gradeIndex = 0;
        this.xp = 0;
        this.berries = 0;
        this.bounty = 0;
        this.wantedLevel = 0;
        this.isJailed = false;
        this.stats = {
            trainCount: 0,
            pillageCount: 0,
            wins: 0,
            losses: 0
        };
    }
}
module.exports = { Player };
