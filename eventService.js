class EventService {
  constructor() {
    this.events = new Map();
    this.active = null;
  }

  createEvent({ id, title, description, location, type = 'historique', status = 'pending', startsAt = null }) {
    if (!id || !title) {
      throw new Error('Événement incomplet');
    }

    const event = {
      id,
      title,
      description,
      location,
      type,
      status,
      startsAt: startsAt || new Date().toISOString(),
      scenes: [],
      actors: [],
      messages: [],
      conditions: [],
      rewards: [],
      consequences: [],
      history: []
    };

    this.events.set(id, event);
    return event;
  }

  activate(id) {
    const event = this.events.get(id);
    if (!event) throw new Error('Événement introuvable');
    event.status = 'active';
    this.active = event.id;
    return event;
  }

  close(id) {
    const event = this.events.get(id);
    if (!event) throw new Error('Événement introuvable');
    event.status = 'closed';
    if (this.active === id) this.active = null;
    return event;
  }

  listActiveEvents() {
    return [...this.events.values()].filter((event) => event.status === 'active');
  }

  getBannerData() {
    const active = this.listActiveEvents()[0];
    if (!active) {
      return null;
    }

    return {
      title: active.title,
      location: active.location,
      status: active.status,
      type: active.type,
      message: `⚔️ ÉVÉNEMENT MONDIAL\n${active.title}\n📍 ${active.location}\n🔴 ${active.status.toUpperCase()}`
    };
  }
}

module.exports = { EventService };
