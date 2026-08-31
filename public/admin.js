const ADMIN_ACTOR_ID = 'admin_owner';

function getStoredToken() {
  return localStorage.getItem('grandline-token') || null;
}

function getStoredAdminToken() {
  return localStorage.getItem('grandline-admin-token') || null;
}

function clearStaleTokens() {
  const adminToken = getStoredAdminToken();
  const token = getStoredToken();

  if (adminToken) {
    localStorage.removeItem('grandline-admin-token');
  }

  if (token) {
    localStorage.removeItem('grandline-token');
  }
}

async function fetchJson(url, options = {}) {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    if (response.status === 401) {
      if (url.includes('/api/admin/')) {
        localStorage.removeItem('grandline-admin-token');
      } else if (!url.includes('/api/auth/')) {
        localStorage.removeItem('grandline-token');
      }
    }
    throw new Error(data?.error || data || 'Erreur serveur');
  }

  return data;
}

async function fetchAdminJson(url, options = {}) {
  const token = getStoredAdminToken();
  return fetchJson(url, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
}

function setAdminStatus(message, isError = false) {
  const statusEl = document.getElementById('admin-status');
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

async function loadAdminWorldState() {
  const infoEl = document.getElementById('admin-world-info');
  if (!infoEl) return;

  try {
    const adminToken = getStoredAdminToken();
    const worldStatePromise = fetchJson('/api/world/state');
    const bannerPromise = fetchJson('/api/world/banner');
    const logsPromise = adminToken
      ? fetchAdminJson('/api/admin/logs').catch(() => {
          localStorage.removeItem('grandline-admin-token');
          return { logs: [] };
        })
      : Promise.resolve({ logs: [] });

    const [worldState, banner, logsData] = await Promise.all([
      worldStatePromise,
      bannerPromise,
      logsPromise
    ]);

    const institutionList = Object.entries(worldState.institutions || {}).map(([key, value]) => `${key}: ${value}`).join(', ') || 'Aucune';
    const factionList = Object.entries(worldState.factions || {}).map(([key, value]) => `${key}: ${value.status || 'active'}`).join(', ') || 'Aucune';
    const bannerLabel = banner?.banner?.title || 'Aucun événement';
    const logs = (logsData.logs || []).slice(0, 4).map((log) => `${log.action} • ${log.motif || log.details || 'Aucune raison'}`).join('<br>') || 'Aucun log récent';

    infoEl.innerHTML = `
      <div class="admin-info-row"><span>Ère</span><strong>${worldState.era || 'Inconnue'}</strong></div>
      <div class="admin-info-row"><span>Événement</span><strong>${bannerLabel}</strong></div>
      <div class="admin-info-row"><span>Institutions</span><strong>${institutionList}</strong></div>
      <div class="admin-info-row"><span>Factions</span><strong>${factionList}</strong></div>
      <div class="admin-info-row admin-log-row"><span>Logs</span><strong>${logs}</strong></div>
    `;
  } catch (error) {
    infoEl.innerHTML = '<div class="admin-info-row"><span>Statut</span><strong>Impossible de charger le monde</strong></div>';
    setAdminStatus(error.message, true);
  }
}

async function loginAdminFromPanel() {
  const usernameInput = document.getElementById('admin-login-username');
  const pinInput = document.getElementById('admin-login-pin');

  if (!usernameInput || !pinInput) {
    return;
  }

  const username = usernameInput.value.trim();
  const pin = pinInput.value.trim();

  if (!username || !pin) {
    setAdminStatus('Nom d’administrateur et code requis.', true);
    return;
  }

  try {
    const data = await fetchJson('/api/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, pin })
    });

    const token = data?.session?.token || data?.token;
    if (!token) {
      throw new Error('Token d’administration absent');
    }

    localStorage.setItem('grandline-admin-token', token);
    setAdminStatus(`Connexion admin réussie pour ${username}.`);
    pinInput.value = '';
    await loadAdminWorldState();
  } catch (error) {
    setAdminStatus(error.message, true);
  }
}

async function createEventFromAdmin() {
  const titleInput = document.getElementById('admin-event-title');
  const locationInput = document.getElementById('admin-event-location');
  const typeInput = document.getElementById('admin-event-type');
  const descriptionInput = document.getElementById('admin-event-description');

  if (!titleInput || !locationInput || !typeInput || !descriptionInput) return;

  const title = titleInput.value.trim();
  const location = locationInput.value.trim();
  const type = typeInput.value.trim() || 'historique';
  const description = descriptionInput.value.trim();

  if (!title || !location) {
    setAdminStatus('Le titre et la localisation sont requis.', true);
    return;
  }

  if (!getStoredToken()) {
    setAdminStatus('Connecte-toi d’abord en tant qu’admin pour créer un événement.', true);
    return;
  }

  try {
    await fetchAdminJson('/api/admin/event/create', {
      method: 'POST',
      body: JSON.stringify({
        actorId: ADMIN_ACTOR_ID,
        title,
        location,
        type,
        description
      })
    });

    setAdminStatus(`Événement créé : ${title}`);
    titleInput.value = '';
    locationInput.value = '';
    typeInput.value = '';
    descriptionInput.value = '';
    await loadAdminWorldState();
  } catch (error) {
    setAdminStatus(error.message, true);
  }
}

async function createStaffFromAdmin() {
  const usernameInput = document.getElementById('admin-staff-username');
  const roleInput = document.getElementById('admin-staff-role');

  if (!usernameInput || !roleInput) return;

  const username = usernameInput.value.trim();
  const role = roleInput.value;

  if (!username) {
    setAdminStatus('Le nom du staff est requis.', true);
    return;
  }

  try {
    await fetchAdminJson('/api/admin/staff/create', {
      method: 'POST',
      body: JSON.stringify({
        actorId: ADMIN_ACTOR_ID,
        username,
        role
      })
    });

    setAdminStatus(`Staff ajouté : ${username} (${role})`);
    usernameInput.value = '';
    roleInput.value = 'MOD_CHAT';
    await loadAdminWorldState();
  } catch (error) {
    setAdminStatus(error.message, true);
  }
}

async function resolveWorldEventFromAdmin() {
  const territoryInput = document.getElementById('admin-world-territory');
  const factionInput = document.getElementById('admin-world-faction');
  const deltaInput = document.getElementById('admin-world-delta');
  const summaryInput = document.getElementById('admin-world-summary');

  if (!territoryInput || !factionInput || !deltaInput || !summaryInput) return;

  const territoryId = territoryInput.value.trim();
  const factionId = factionInput.value.trim() || 'civil';
  const deltaInfluence = Number(deltaInput.value || 0);
  const summary = summaryInput.value.trim() || 'Impact mondial appliqué par l’administration';

  if (!territoryId) {
    setAdminStatus('Le territoire est requis pour appliquer un impact.', true);
    return;
  }

  try {
    const result = await fetchAdminJson('/api/admin/world/events/resolve', {
      method: 'POST',
      body: JSON.stringify({
        eventId: 'event_world_001',
        factionId,
        territoryId,
        deltaInfluence,
        summary
      })
    });

    setAdminStatus(`Impact appliqué sur ${territoryId} pour la faction ${factionId}.`);
    territoryInput.value = '';
    factionInput.value = '';
    deltaInput.value = '5';
    summaryInput.value = '';
    await loadAdminWorldState();
    return result;
  } catch (error) {
    setAdminStatus(error.message, true);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const panel = document.getElementById('admin-panel');
  const toggleButton = document.getElementById('admin-toggle');
  const eventButton = document.getElementById('admin-event-submit');
  const staffButton = document.getElementById('admin-staff-submit');
  const loginButton = document.getElementById('admin-login-submit');
  const resolveWorldButton = document.getElementById('admin-world-resolve-submit');

  if (!panel || !toggleButton) return;

  toggleButton.addEventListener('click', () => {
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
      loadAdminWorldState();
    }
  });

  if (eventButton) {
    eventButton.addEventListener('click', createEventFromAdmin);
  }

  if (staffButton) {
    staffButton.addEventListener('click', createStaffFromAdmin);
  }

  if (loginButton) {
    loginButton.addEventListener('click', loginAdminFromPanel);
  }

  if (resolveWorldButton) {
    resolveWorldButton.addEventListener('click', resolveWorldEventFromAdmin);
  }

  if (getStoredToken()) {
    setAdminStatus('Session admin active.');
  }

  loadAdminWorldState();
});
