// marketManager.js
class MarketManager {
  constructor() {
    this.listings = new Map();
  }

  createListing({ sellerId, item, itemId, name, slot = 'misc', rarity = 'commun', type = 'objet', description = '', price, quantity = 1, seller = null }) {
    const itemPayload = item || {
      id: itemId,
      name: name || 'Objet générique',
      slot,
      rarity,
      type,
      description,
      value: 0
    };

    if (!sellerId || !itemPayload?.id || price <= 0) {
      throw new Error('Paramètres de vente invalides');
    }

    const effectiveSeller = seller || null;
    if (effectiveSeller && typeof effectiveSeller.removeItem === 'function') {
      const itemKey = itemPayload.id;
      const inventoryItem = effectiveSeller.inventory?.find((entry) => entry.id === itemKey);
      if (inventoryItem) {
        effectiveSeller.removeItem(itemKey);
      }
    }

    const listingId = `listing_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const listing = {
      id: listingId,
      sellerId,
      item: itemPayload,
      itemId: itemPayload.id,
      price,
      quantity,
      createdAt: new Date().toISOString()
    };

    this.listings.set(listingId, listing);
    return listing;
  }

  buyListing(buyer, listingId, seller = null) {
    const listing = this.listings.get(listingId);
    if (!listing) {
      throw new Error("Cette offre n'existe plus");
    }

    if (!buyer || !buyer.id) {
      throw new Error('Acheteur invalide');
    }

    if (listing.sellerId === buyer.id) {
      throw new Error("Vous ne pouvez pas acheter votre propre article");
    }

    if ((buyer.money || 0) < Number(listing.price)) {
      throw new Error('Fonds insuffisants');
    }

    const sellerRef = seller || null;
    const itemId = listing.itemId || listing.item?.id;

    if (sellerRef && Array.isArray(sellerRef.inventory)) {
      const soldIndex = sellerRef.inventory.findIndex((entry) => entry.id === itemId);
      if (soldIndex >= 0) {
        sellerRef.inventory.splice(soldIndex, 1);
      }
    }

    if (sellerRef && typeof sellerRef.removeItem === 'function') {
      sellerRef.removeItem(itemId);
    }

    buyer.money = Number(buyer.money || 0) - Number(listing.price);
    if (sellerRef) {
      sellerRef.money = Number(sellerRef.money || 0) + Number(listing.price);
    }

    const purchasedItem = {
      ...listing.item,
      id: listing.item.id,
      name: listing.item.name,
      slot: listing.item.slot || 'misc',
      rarity: listing.item.rarity || 'commun',
      type: listing.item.type || 'objet',
      description: listing.item.description || '',
      value: listing.item.value || 0
    };

    if (!Array.isArray(buyer.inventory)) {
      buyer.inventory = [];
    }

    buyer.inventory.push(purchasedItem);
    this.listings.delete(listingId);

    return {
      success: true,
      itemId: listing.itemId,
      item: purchasedItem,
      price: listing.price,
      buyerId: buyer.id,
      sellerId: listing.sellerId
    };
  }

  listListings() {
    return [...this.listings.values()];
  }
}

module.exports = { MarketManager };
