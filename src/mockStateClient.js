// Mock StateClient for development with localStorage persistence
export class StateClient {
  constructor(config) {
    this.baseURL = config.baseURL;
    this.appId = config.appId;
    this.storagePrefix = 'solsnake_';
    this.mockData = {
      daily_payments: new Map(),
      players: new Map(),
      daily_winners: new Map()
    };
    this._loadFromStorage();
    // Optional server persistence via Vercel KV API (/api/state)
    this.useApi = (typeof window !== 'undefined') && (import.meta?.env?.VITE_USE_API_STORAGE === '1');
    console.log('Mock StateClient initialized with:', { ...config, useApi: this.useApi });
  }

  _loadFromStorage() {
    try {
      const load = (key) => {
        const raw = localStorage.getItem(this.storagePrefix + key);
        if (!raw) return;
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          const map = new Map(arr.map(e => [e.id, e]));
          this.mockData[key] = map;
        }
      };
      load('daily_payments');
      load('players');
      load('daily_winners');
    } catch (e) {
      console.warn('StateClient: failed to load from localStorage', e);
    }
  }

  _saveToStorage(entityType) {
    try {
      const map = this.mockData[entityType];
      if (!map) return;
      const arr = Array.from(map.values());
      localStorage.setItem(this.storagePrefix + entityType, JSON.stringify(arr));
      // Mirror to static-like files area as best-effort (read-only on server)
      // These are exposed for manual export/debug via the network panel when served.
    } catch (e) {
      console.warn('StateClient: failed to save to localStorage', e);
    }
  }

  async getEntities(entityType, filters = {}) {
    // Try server API if configured
    if (this.useApi) {
      try {
        const params = new URLSearchParams({ type: entityType });
        if (filters.date) params.set('date', filters.date);
        const res = await fetch(`/api/state?${params.toString()}`, { cache: 'no-store' });
        if (res.ok) return await res.json();
      } catch (_) {}
    }
    if (!this.mockData[entityType]) return [];
    let entities = Array.from(this.mockData[entityType].values());
    if (filters.date) entities = entities.filter(e => e.date === filters.date);
    return entities;
  }

  async getEntity(entityType, id) {
    if (this.useApi) {
      try {
        const params = new URLSearchParams({ type: entityType, id });
        const res = await fetch(`/api/state?${params.toString()}`, { cache: 'no-store' });
        if (res.ok) return await res.json();
      } catch (_) {}
    }
    if (!this.mockData[entityType]) return null;
    return this.mockData[entityType].get(id) || null;
  }

  async createEntity(entityType, data) {
    if (this.useApi) {
      try {
        const res = await fetch(`/api/state?type=${encodeURIComponent(entityType)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) {
          const out = await res.json();
          // mirror locally for fast reads
          const id = out.id;
          if (!this.mockData[entityType]) this.mockData[entityType] = new Map();
          this.mockData[entityType].set(id, { ...data, id });
          this._saveToStorage(entityType);
          return out;
        }
      } catch (_) {}
    }
    if (!this.mockData[entityType]) this.mockData[entityType] = new Map();
    const id = data.id || `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const entity = { ...data, id };
    this.mockData[entityType].set(id, entity);
    this._saveToStorage(entityType);
    return { success: true, id };
  }

  async updateEntity(entityType, id, data) {
    if (this.useApi) {
      try {
        const params = new URLSearchParams({ type: entityType, id });
        const res = await fetch(`/api/state?${params.toString()}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) {
          const existing = this.mockData[entityType]?.get(id) || {};
          const updated = { ...existing, ...data, id };
          if (!this.mockData[entityType]) this.mockData[entityType] = new Map();
          this.mockData[entityType].set(id, updated);
          this._saveToStorage(entityType);
          return await res.json();
        }
      } catch (_) {}
    }
    if (!this.mockData[entityType]) this.mockData[entityType] = new Map();
    const existing = this.mockData[entityType].get(id);
    if (existing) {
      const updated = { ...existing, ...data, id };
      this.mockData[entityType].set(id, updated);
    } else {
      const entity = { ...data, id };
      this.mockData[entityType].set(id, entity);
    }
    this._saveToStorage(entityType);
    return { success: true };
  }

  async deleteEntity(entityType, id) {
    if (this.useApi) {
      try {
        const params = new URLSearchParams({ type: entityType, id });
        const res = await fetch(`/api/state?${params.toString()}`, { method: 'DELETE' });
        if (res.ok) {
          this.mockData[entityType]?.delete(id);
          this._saveToStorage(entityType);
          return await res.json();
        }
      } catch (_) {}
    }
    if (this.mockData[entityType]) {
      this.mockData[entityType].delete(id);
      this._saveToStorage(entityType);
    }
    return { success: true };
  }

  // Helper method to simulate payment verification
  simulatePayment(walletAddress, date) {
    const paymentId = `${walletAddress}_${date}`;
    const payment = {
      id: paymentId,
      wallet: walletAddress,
      amount: 0.01,
      date: date,
      signature: `mock-signature-${Date.now()}`,
      timestamp: Date.now(),
      confirmed: true
    };
    
    if (!this.mockData.daily_payments) {
      this.mockData.daily_payments = new Map();
    }
    
    this.mockData.daily_payments.set(paymentId, payment);
    console.log(`Mock: Simulated payment for ${walletAddress} on ${date}`);
  }
}
