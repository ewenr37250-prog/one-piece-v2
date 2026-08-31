const fs = require('fs');
const path = require('path');

class PersistenceService {
  constructor({ filePath = './data/game-state.json', createDir = false } = {}) {
    this.filePath = path.resolve(filePath);
    this.createDir = createDir;
  }

  ensureDirectory() {
    if (!this.createDir) return;
    const directory = path.dirname(this.filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
  }

  async save(data) {
    this.ensureDirectory();
    const payload = {
      ...data,
      savedAt: new Date().toISOString()
    };

    return fs.promises.writeFile(this.filePath, JSON.stringify(payload, null, 2), 'utf8');
  }

  async load() {
    try {
      const raw = await fs.promises.readFile(this.filePath, 'utf8');
      return JSON.parse(raw);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { players: [], world: {}, updatedAt: null };
      }
      throw error;
    }
  }

  async delete() {
    try {
      await fs.promises.unlink(this.filePath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }
}

module.exports = { PersistenceService };
