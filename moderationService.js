class ModerationService {
  constructor() {
    this.staff = new Map();
    this.auditLogs = [];
    this.roleHierarchy = {
      OWNER: 1000,
      SUPER_MOD: 900,
      RESPONSABLE: 700,
      MOD_CHAT: 500,
      MOD_TERRAIN: 500,
      STAFF_RP_EVENT: 450,
      SUPPORT: 300
    };
    this.permissions = {
      OWNER: ['*'],
      SUPER_MOD: ['staff.manage', 'players.moderate', 'events.manage', 'world.manage'],
      RESPONSABLE: ['players.moderate', 'events.manage_limited', 'world.read'],
      MOD_CHAT: ['chat.moderate'],
      MOD_TERRAIN: ['terrain.manage'],
      STAFF_RP_EVENT: ['events.manage_limited'],
      SUPPORT: ['support.read']
    };
  }

  addStaff({ id, username, role, permissions = [] }) {
    if (!id || !username || !role) {
      throw new Error('Compte staff incomplet');
    }

    const normalizedRole = String(role).toUpperCase();
    if (!this.roleHierarchy[normalizedRole]) {
      throw new Error(`Rôle inconnu : ${role}`);
    }
    if (normalizedRole === 'OWNER' && this.getStaffByRole('OWNER')) {
      throw new Error('Un seul Owner est autorisé');
    }
    if (normalizedRole === 'SUPER_MOD' && this.getStaffByRole('SUPER_MOD')) {
      throw new Error('Un seul Super Mod est autorisé');
    }

    const account = {
      id,
      username,
      role: normalizedRole,
      permissions: [...new Set([...(this.permissions[normalizedRole] || []), ...permissions])],
      createdAt: new Date().toISOString()
    };

    this.staff.set(id, account);
    this.staff.set(username, account);
    this.log({
      actorId: 'system',
      action: 'staff.add',
      targetId: id,
      details: `Ajout du staff ${username} (${normalizedRole})`
    });
    return account;
  }

  getStaffByRole(role) {
    for (const staff of this.staff.values()) {
      if (staff.role === role) {
        return staff;
      }
    }
    return null;
  }

  getStaffByIdentifier(identifier) {
    if (!identifier) return null;
    if (this.staff.has(identifier)) {
      return this.staff.get(identifier) || null;
    }
    return [...this.staff.values()].find((staff) => staff.id === identifier || staff.username === identifier) || null;
  }

  can(actorId, permission) {
    const staff = this.getStaffByIdentifier(actorId);
    if (!staff) return false;
    if (staff.permissions.includes('*')) return true;
    if (staff.role === 'OWNER' || staff.role === 'SUPER_MOD') {
      return true;
    }
    return staff.permissions.includes(permission);
  }

  log({ actorId, action, targetId, details, oldValue, newValue, reason }) {
    this.auditLogs.push({
      date: new Date().toISOString(),
      actorId,
      action,
      targetId: targetId || null,
      ancienneValeur: oldValue || null,
      nouvelleValeur: newValue || null,
      motif: reason || details || null,
      details: details || null
    });
    return this.auditLogs[this.auditLogs.length - 1];
  }

  listLogs() {
    return [...this.auditLogs];
  }
}

module.exports = { ModerationService };
