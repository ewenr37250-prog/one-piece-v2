// staffService.js
const ROLE_HIERARCHY = {
  OWNER: 1000,
  SUPER_MOD: 900,
  RESPONSABLE: 700,
  MOD_CHAT: 500
};

const DEFAULT_ROLE_PERMISSIONS = {
  OWNER: ["*"],
  SUPER_MOD: ["staff.manage", "players.moderate", "events.manage"],
  RESPONSABLE: ["players.moderate", "events.manage_limited"],
  MOD_CHAT: ["chat.moderate"]
};

class StaffAccount {
  constructor({ id, username, role }) {
    this.id = id;
    this.username = username;
    this.role = role;
    this.permissions = new Set(DEFAULT_ROLE_PERMISSIONS[role] || []);
  }
}

class StaffService {
  constructor() {
    this.accounts = new Map();
  }

  addOwner(data) {
    const account = new StaffAccount({ ...data, role: "OWNER" });
    this.accounts.set(account.id, account);
    return account;
  }
}

module.exports = { StaffService, StaffAccount, ROLE_HIERARCHY };
