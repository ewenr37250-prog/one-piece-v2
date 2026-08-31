const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class AuthService {
  constructor({ jwtSecret = process.env.JWT_SECRET || 'dev-secret', adminPin = process.env.ADMIN_PIN || '7777' } = {}) {
    this.jwtSecret = jwtSecret;
    this.adminPin = adminPin;
    this.users = new Map();
  }

  registerUser({ username, password, role = 'player' }) {
    if (!username || !password) {
      throw new Error('Nom d’utilisateur et mot de passe requis');
    }

    const normalizedUsername = String(username).trim();
    const key = normalizedUsername.toLowerCase();

    if (this.users.has(key)) {
      throw new Error('Compte déjà existant');
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const user = {
      username: normalizedUsername,
      passwordHash,
      role,
      createdAt: new Date().toISOString()
    };

    this.users.set(key, user);
    return { username: normalizedUsername, role, passwordHash };
  }

  loginUser({ username, password }) {
    const key = String(username || '').trim().toLowerCase();
    const user = this.users.get(key);
    if (!user) {
      throw new Error('Compte introuvable');
    }

    const valid = bcrypt.compareSync(password, user.passwordHash);
    if (!valid) {
      throw new Error('Identifiants invalides');
    }

    const token = jwt.sign({ username: user.username, role: user.role }, this.jwtSecret, { expiresIn: '12h' });
    return { success: true, token, user: { username: user.username, role: user.role } };
  }

  verifyToken(token) {
    return jwt.verify(token, this.jwtSecret);
  }

  loginAdmin({ username, pin }) {
    if (!username) {
      throw new Error('Nom d’administrateur requis');
    }

    if (pin !== this.adminPin) {
      throw new Error('Code d’administration invalide');
    }

    const token = jwt.sign({ username, role: 'admin' }, this.jwtSecret, { expiresIn: '12h' });
    return { success: true, token, user: { username, role: 'admin' } };
  }
}

module.exports = { AuthService };
