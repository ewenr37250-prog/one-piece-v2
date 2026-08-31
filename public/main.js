let CURRENT_USER = localStorage.getItem('grandline-username') || 'JoueurPublic';
const SERVER_URL = '';
const CLASS_OPTIONS = ['pirate', 'marine', 'civil'];
let selectedClass = localStorage.getItem('grandline-class') || 'pirate';

function getStoredToken() {
    return localStorage.getItem('grandline-token') || null;
}

async function fetchJson(url, options = {}) {
    const token = getStoredToken();
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {})
        }
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok) {
        if (response.status === 401 && !url.includes('/api/auth/')) {
            localStorage.removeItem('grandline-token');
        }
        throw new Error(data?.error || data || 'Erreur serveur');
    }

    return data;
}

const ISLANDS = [
    { id: 'windmill', name: 'Village de la Girouette', ico: '🧭', desc: 'Une brise légère fait tourner les moulins.' },
    { id: 'loguetown', name: 'Loguetown', ico: '⚓', desc: 'Une cité pleine d’histoire et de trafics.' },
    { id: 'marineford', name: 'Marineford', ico: '🏛️', desc: 'Le bastion de la Marine et des grands affrontements.' }
];

const state = {
    player: {},
    quests: [],
    activeQuests: [],
    reputations: {},
    inventory: [],
    equipment: {},
    world: {
        banner: null,
        events: [],
        factions: [],
        territories: [],
        npcs: [],
        summary: null
    }
};

function persistSession(username, token) {
    if (username) {
        localStorage.setItem('grandline-username', username);
        CURRENT_USER = username;
    }

    if (token) {
        localStorage.setItem('grandline-token', token);
    }
}

function applyClassTheme(classType = 'civil') {
    const normalised = CLASS_OPTIONS.includes(classType) ? classType : 'civil';
    document.body.dataset.faction = normalised;
    const playerLabel = document.getElementById('hud-name');
    if (playerLabel) {
        playerLabel.dataset.faction = normalised;
    }
}

function bindClassPicker() {
    document.querySelectorAll('.class-option').forEach((button) => {
        button.classList.toggle('active', button.dataset.class === selectedClass);
        button.addEventListener('click', () => {
            selectedClass = button.dataset.class || 'pirate';
            localStorage.setItem('grandline-class', selectedClass);
            document.querySelectorAll('.class-option').forEach((option) => option.classList.toggle('active', option.dataset.class === selectedClass));
        });
    });
}

function showAuthMessage(message, isError = false) {
    const target = document.getElementById('auth-messages');
    if (!target) return;

    target.textContent = message;
    target.style.color = isError ? '#ffb3b3' : '#dfeeff';
}

async function login() {
    const username = document.getElementById('auth-username')?.value?.trim();
    const password = document.getElementById('auth-password')?.value || '';

    if (!username || !password) {
        showAuthMessage('Nom d’utilisateur et mot de passe requis.', true);
        return;
    }

    try {
        const data = await fetchJson(`${SERVER_URL}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ username, password, classType: selectedClass })
        });

        const token = data.session?.token || data.token;
        if (token) {
            persistSession(username, token);
        } else {
            persistSession(username, null);
        }

        document.getElementById('auth-screen')?.classList.add('hidden');
        document.getElementById('game-ui')?.classList.add('visible');
        await initGame();
    } catch (error) {
        showAuthMessage(error.message, true);
    }
}

async function register() {
    const username = document.getElementById('auth-username')?.value?.trim();
    const password = document.getElementById('auth-password')?.value || '';

    if (!username || !password) {
        showAuthMessage('Choisis un nom et un mot de passe.', true);
        return;
    }

    try {
        const data = await fetchJson(`${SERVER_URL}/api/auth/register`, {
            method: 'POST',
            body: JSON.stringify({ username, password, classType: selectedClass })
        });

        showAuthMessage('Compte créé. Connexion en cours...');
        const registeredUsername = data?.player?.username || data?.user?.username || username;
        if (registeredUsername) {
            persistSession(registeredUsername, null);
        }
        await login();
    } catch (error) {
        showAuthMessage(error.message, true);
    }
}

async function initGame() {
    await fetchPlayerData();
    await fetchInventoryData();
    await fetchWorldData();
    await fetchQuestData();
    renderMap();
    bindQuestHandlers();
}

async function fetchPlayerData() {
    try {
        const data = await fetchJson(`${SERVER_URL}/api/player/${CURRENT_USER}`);
        state.player = data;
        state.inventory = state.player.inventory || [];
        state.equipment = state.player.equipment || {};
        if (state.player.classType || state.player.faction) {
            selectedClass = state.player.classType || state.player.faction || selectedClass;
            localStorage.setItem('grandline-class', selectedClass);
        }
        applyClassTheme(selectedClass);
        updateHUD();
        renderInventory();
    } catch (error) {
        const backup = await fetchJson(`${SERVER_URL}/api/player/login`, {
            method: 'POST',
            body: JSON.stringify({ username: CURRENT_USER, faction: selectedClass, classType: selectedClass })
        });
        state.player = backup.player || {};
        state.inventory = state.player.inventory || [];
        state.equipment = state.player.equipment || {};
        updateHUD();
        renderInventory();
    }
}

async function fetchInventoryData() {
    try {
        const data = await fetchJson(`${SERVER_URL}/api/player/${CURRENT_USER}/inventory`);
        state.inventory = data.inventory || [];
        state.equipment = data.equipment || {};
        renderInventory();
    } catch (error) {
        state.inventory = state.player.inventory || [];
        state.equipment = state.player.equipment || {};
        renderInventory();
    }
}

async function fetchWorldData() {
    const requests = [
        fetch(`${SERVER_URL}/api/world/banner`),
        fetch(`${SERVER_URL}/api/world/events`),
        fetch(`${SERVER_URL}/api/world/factions`),
        fetch(`${SERVER_URL}/api/world/territories`),
        fetch(`${SERVER_URL}/api/world/npcs`),
        fetch(`${SERVER_URL}/api/world/summary`)
    ];

    const results = await Promise.allSettled(requests);

    for (const [index, result] of results.entries()) {
        if (result.status !== 'fulfilled' || !result.value?.ok) continue;

        const data = await result.value.json().catch(() => ({}));

        if (index === 0) {
            state.world.banner = data.banner || null;
        }
        if (index === 1) {
            state.world.events = data.events || [];
        }
        if (index === 2) {
            state.world.factions = data.factions || [];
        }
        if (index === 3) {
            state.world.territories = data.territories || [];
        }
        if (index === 4) {
            state.world.npcs = data.npcs || [];
        }
        if (index === 5) {
            state.world.summary = data || null;

            if (Array.isArray(data?.factions) && data.factions.length > 0) {
                state.world.factions = data.factions;
            }

            if (Array.isArray(data?.territories) && data.territories.length > 0) {
                state.world.territories = data.territories;
            }

            if (data?.activeEvent) {
                state.world.banner = data.activeEvent;
            }
        }
    }

    renderWorldInfo();
    bindNpcInteraction();
}

async function fetchQuestData() {
    const requests = [
        fetch(`${SERVER_URL}/api/quests`),
        fetch(`${SERVER_URL}/api/quests/${CURRENT_USER}`),
        fetch(`${SERVER_URL}/api/market/listings`)
    ];

    const results = await Promise.allSettled(requests);

    for (const [index, result] of results.entries()) {
        if (result.status !== 'fulfilled' || !result.value?.ok) continue;

        const data = await result.value.json().catch(() => ({}));

        if (index === 0) {
            state.quests = data.quests || [];
        }
        if (index === 1) {
            state.activeQuests = data.active || [];
            state.reputations = data.reputations || {};
        }
        if (index === 2) {
            state.market = data.listings || [];
        }
    }

    renderQuestList();
    renderReputation();
    renderMarket();
}

function updateHUD() {
    const hudName = document.getElementById('hud-name');
    const hudMoney = document.getElementById('hud-money');
    const hudIsland = document.getElementById('hud-island');

    if (hudName) hudName.textContent = state.player.username || CURRENT_USER;
    if (hudMoney) hudMoney.textContent = `${state.player.money || 0} ฿`;
    if (hudIsland) {
        const fruitLabel = state.player.devilFruit?.name ? ` • Fruit : ${state.player.devilFruit.name}` : '';
        hudIsland.textContent = `Île : ${state.player.current_island || 'windmill'}${fruitLabel}`;
    }
}

function renderMap() {
    const mapEl = document.getElementById('game-map');
    if (!mapEl) return;

    mapEl.innerHTML = ISLANDS.map((island) => {
        const current = state.player.current_island === island.id;
        return `
            <button class="island-card ${current ? 'active' : ''}" data-island="${island.id}">
                <span>${island.ico}</span>
                <strong>${island.name}</strong>
                <small>${island.desc}</small>
            </button>
        `;
    }).join('');

    mapEl.querySelectorAll('.island-card').forEach((button) => {
        button.addEventListener('click', () => {
            const islandId = button.dataset.island;
            navigateToIsland(islandId);
        });
    });
}

async function navigateToIsland(targetId) {
    const res = await fetch(`${SERVER_URL}/api/navigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: CURRENT_USER, target_island: targetId })
    });

    if (res.ok) {
        const data = await res.json();
        state.player = data.player || state.player;
        state.player.current_island = targetId;
        updateHUD();
        renderMap();
        await fetchQuestData();
    }
}

function renderInventory() {
    const inventoryList = document.getElementById('inventory-list');
    const equipmentList = document.getElementById('equipment-list');

    if (inventoryList) {
        inventoryList.innerHTML = (state.inventory || []).length
            ? (state.inventory || []).map((item) => `
                <div class="quest-item">
                    <div>
                        <strong>${item.name}</strong>
                        <p>${item.type || 'objet'} • ${item.rarity || 'commun'}</p>
                    </div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button data-item-id="${item.id}" data-slot="${item.slot || 'misc'}" class="equip-btn">Équiper</button>
                        <button data-item-id="${item.id}" data-item-name="${encodeURIComponent(item.name || 'Objet')}" data-item-value="${Number(item.value || 0)}" class="sell-btn">Vendre</button>
                    </div>
                </div>
            `).join('')
            : '<div class="quest-item"><div><strong>Vide</strong><p>Ton sac est vide pour l’instant.</p></div></div>';
    }

    if (equipmentList) {
        const slots = Object.entries(state.equipment || {});
        equipmentList.innerHTML = slots.length
            ? slots.map(([slot, itemId]) => `
                <div class="reputation-item">
                    <span>${slot}</span>
                    <strong>${itemId || 'vide'}</strong>
                </div>
            `).join('')
            : '<div class="reputation-item"><span>Équipement</span><strong>vide</strong></div>';
    }

    document.querySelectorAll('.equip-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            const itemId = button.dataset.itemId;
            const slot = button.dataset.slot;

            const res = await fetch(`${SERVER_URL}/api/player/${CURRENT_USER}/inventory/equip`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slot, itemId })
            });

            if (res.ok) {
                await fetchInventoryData();
            }
        });
    });

    document.querySelectorAll('.sell-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            const itemId = button.dataset.itemId;
            const item = (state.inventory || []).find((entry) => entry.id === itemId);
            if (!item) return;

            const suggestedPrice = Math.max(10, Number(item.value || 25));
            const rawPrice = window.prompt(`Prix de vente pour ${item.name || 'l’objet'} (en ฿)`, String(suggestedPrice));
            if (rawPrice === null) return;

            const price = Number(rawPrice);
            if (!Number.isFinite(price) || price <= 0) {
                window.alert('Le prix doit être un nombre positif.');
                return;
            }

            try {
                const data = await fetchJson(`${SERVER_URL}/api/market/listings`, {
                    method: 'POST',
                    body: JSON.stringify({ sellerId: CURRENT_USER, itemId: item.id, item, price, quantity: 1 })
                });

                if (data.success) {
                    await fetchInventoryData();
                    await fetchQuestData();
                }
            } catch (error) {
                console.warn(error.message);
                window.alert(error.message);
            }
        });
    });
}

function dedupeFactionEntries(entries = []) {
    const seen = new Set();
    return (entries || []).filter((faction) => {
        const key = String(faction?.id || faction?.name || '').trim().toLowerCase() || String(faction?.name || '').trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function renderWorldInfo() {
    const eventList = document.getElementById('world-event');
    const factionList = document.getElementById('world-factions');
    const territoryList = document.getElementById('world-territories');
    const npcList = document.getElementById('world-npcs');

    if (eventList) {
        const banner = state.world.banner || state.world.summary?.activeEvent || null;
        const events = (state.world.events || []).slice(0, 3).map((event) => `<div class="reputation-item"><span>${event.title}</span><strong>${event.status || 'active'}</strong></div>`).join('');
        eventList.innerHTML = banner
            ? `<div class="world-info-box-inner"><strong>${banner.title}</strong><p>${banner.location || 'Monde'}</p><small>${banner.status || 'active'}</small>${events ? `<div class="stack-list" style="margin-top:8px;">${events}</div>` : ''}</div>`
            : '<div class="world-info-box-inner"><strong>Calme</strong><p>Aucun événement majeur en cours.</p></div>';
    }

    const eventBtn = document.getElementById('event-resolve-btn');
    if (eventBtn) {
        eventBtn.onclick = async () => {
            const banner = state.world.banner;
            if (!banner) return;

            const res = await fetch(`${SERVER_URL}/api/world/events/resolve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId: banner.title ? 'event_world_001' : null,
                    factionId: state.player.faction || 'civil',
                    territoryId: state.player.current_island || 'windmill',
                    deltaInfluence: 5,
                    summary: 'Événement mondial réglé par les forces en présence.'
                })
            });

            if (res.ok) {
                await fetchWorldData();
            }
        };
    }

    if (factionList) {
        const factions = dedupeFactionEntries(state.world.factions || []);
        factionList.innerHTML = factions.length
            ? factions.map((faction) => `
                <div class="reputation-item">
                    <span>${faction.name || faction.id}</span>
                    <strong>${faction.type || 'civil'} • ${Number(faction.reputation || 0)}</strong>
                </div>
            `).join('')
            : '<div class="reputation-item"><span>Factions</span><strong>inconnues</strong></div>';
    }

    if (territoryList) {
        territoryList.innerHTML = (state.world.territories || []).length
            ? (state.world.territories || []).map((territory) => {
                const influence = territory.influence ? Object.entries(territory.influence).map(([key, value]) => `${key}:${value}`).join(', ') : 'influence: 0';
                return `
                    <div class="reputation-item">
                        <span>${territory.name || territory.id}</span>
                        <strong>${territory.owner || territory.status || 'neutral'} • ${influence}</strong>
                    </div>
                `;
            }).join('')
            : '<div class="reputation-item"><span>Territoires</span><strong>aucun</strong></div>';
    }

    if (npcList) {
        npcList.innerHTML = (state.world.npcs || []).length
            ? (state.world.npcs || []).map((npc) => `
                <div class="reputation-item">
                    <span>${npc.name}</span>
                    <strong>${npc.type || 'civil'}</strong>
                </div>
            `).join('')
            : '<div class="reputation-item"><span>Personnages</span><strong>aucun</strong></div>';
    }
}

function bindNpcInteraction() {
    const button = document.getElementById('npc-interact-btn');
    if (!button) return;

    button.onclick = async () => {
        const npc = (state.world.npcs || [])[0];
        if (!npc) {
            document.getElementById('npc-dialogue').textContent = 'Aucun NPC disponible.';
            return;
        }

        const res = await fetch(`${SERVER_URL}/api/world/npcs/interact`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ npcId: npc.id, playerFaction: state.player.faction || 'civil' })
        });

        if (res.ok) {
            const data = await res.json();
            document.getElementById('npc-dialogue').textContent = `${data.reaction.message}\n${data.dialogue}`;
        }
    };
}

function renderQuestList() {
    const questList = document.getElementById('quest-list');
    if (!questList) return;

    const activeMap = new Map((state.activeQuests || []).map((quest) => [quest.questId, quest]));

    questList.innerHTML = (state.quests || []).map((quest) => {
        const active = activeMap.get(quest.id);
        const actionLabel = active ? 'Terminer' : 'Accepter';
        const actionType = active ? 'complete' : 'assign';

        return `
            <div class="quest-item">
                <div>
                    <strong>${quest.title}</strong>
                    <p>${quest.description}</p>
                </div>
                <button data-quest-id="${quest.id}" data-action="${actionType}">${actionLabel}</button>
            </div>
        `;
    }).join('');
}

function renderReputation() {
    const list = document.getElementById('reputation-list');
    if (!list) return;

    const factions = Object.keys(state.reputations || {}).length ? state.reputations : { pirates: 0, marine: 0, civils: 0 };
    const unique = Object.entries(factions).reduce((acc, [name, value]) => {
        const key = String(name).trim().toLowerCase();
        if (!acc[key]) acc[key] = value;
        return acc;
    }, {});

    list.innerHTML = Object.entries(unique).map(([name, value]) => `
        <div class="reputation-item">
            <span>${name}</span>
            <strong>${value}</strong>
        </div>
    `).join('');
}

function renderMarket() {
    const list = document.getElementById('market-list');
    if (!list) return;

    const listings = state.market || [];
    list.innerHTML = listings.length
        ? listings.map((listing) => `
            <div class="quest-item">
                <div>
                    <strong>${listing.item?.name || listing.itemId}</strong>
                    <p>${listing.item?.rarity || 'commun'} • ${listing.item?.type || 'objet'} • ${listing.price} ฿</p>
                </div>
                <button data-listing-id="${listing.id}" class="market-buy-btn">Acheter</button>
            </div>
        `).join('')
        : '<div class="quest-item"><div><strong>Marché vide</strong><p>Aucune offre active pour le moment.</p></div></div>';

    list.querySelectorAll('.market-buy-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            const listingId = button.dataset.listingId;
            try {
                const data = await fetchJson(`${SERVER_URL}/api/market/listings/${listingId}/buy`, {
                    method: 'POST',
                    body: JSON.stringify({ buyerId: CURRENT_USER, username: CURRENT_USER })
                });
                if (data.success) {
                    await fetchPlayerData();
                    await fetchQuestData();
                }
            } catch (error) {
                console.warn(error.message);
            }
        });
    });
}

function bindQuestHandlers() {
    const questList = document.getElementById('quest-list');
    if (!questList) return;

    questList.addEventListener('click', async (event) => {
        const target = event.target.closest('button');
        if (!target) return;

        const questId = target.dataset.questId;
        const action = target.dataset.action;
        if (!questId || !action) return;

        const endpoint = action === 'assign' ? `/api/quests/${CURRENT_USER}/assign` : `/api/quests/${CURRENT_USER}/complete`;
        const res = await fetch(`${SERVER_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questId })
        });

        if (res.ok) {
            await fetchQuestData();
        }
    });
}

async function startCombat() {
    const enemies = [{ n: 'Équipage renégat', p: 85, r: 500 }, { n: 'Créature des récifs', p: 155, r: 1500 }];
    const target = enemies[Math.floor(Math.random() * enemies.length)];
    const resultEl = document.getElementById('combat-result');

    try {
        const data = await fetchJson(`${SERVER_URL}/api/combat`, {
            method: 'POST',
            body: JSON.stringify({ username: CURRENT_USER, enemyName: target.n, enemyPower: target.p, enemyReward: target.r })
        });

        const lootMessage = data.lootItem ? `\nButin : ${data.lootItem.name}` : '';
        const message = `${data.message}\nBilan : ${data.loot > 0 ? '+' : ''}${data.loot} ฿${lootMessage}`;

        if (resultEl) {
            resultEl.textContent = message;
        }

        state.player.money = data.current_money;
        state.inventory = data.player?.inventory || state.inventory;
        state.equipment = data.player?.equipment || state.equipment;
        updateHUD();
        renderInventory();
        await fetchInventoryData();
    } catch (error) {
        if (resultEl) {
            resultEl.textContent = `Combat impossible : ${error.message}`;
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const gameUi = document.getElementById('game-ui');
    const savedUser = localStorage.getItem('grandline-username');
    const combatButton = document.getElementById('combat-btn');

    if (combatButton) {
        combatButton.addEventListener('click', startCombat);
    }

    bindClassPicker();
    applyClassTheme(selectedClass);

    if (savedUser) {
        CURRENT_USER = savedUser;
        const usernameField = document.getElementById('auth-username');
        if (usernameField) usernameField.value = savedUser;
    }

    if (gameUi) {
        gameUi.classList.remove('visible');
    }

    const authScreen = document.getElementById('auth-screen');
    if (authScreen) {
        authScreen.classList.remove('hidden');
    }
});
