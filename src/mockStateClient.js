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
    console.log('Mock StateClient initialized with:', config);
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
    // console.log(`Mock: Getting entities of type ${entityType} with filters:`, filters);
    
    if (!this.mockData[entityType]) {
      return [];
    }

    let entities = Array.from(this.mockData[entityType].values());
    
    // Apply filters
    if (filters.date) {
      entities = entities.filter(entity => entity.date === filters.date);
    }
    
    return entities;
  }

  async getEntity(entityType, id) {
    console.log(`Mock: Getting entity ${entityType} with id ${id}`);
    
    if (!this.mockData[entityType]) {
      return null;
    }
    
    return this.mockData[entityType].get(id) || null;
  }

  async createEntity(entityType, data) {
    // console.log(`Mock: Creating entity ${entityType} with data:`, data);
    
    if (!this.mockData[entityType]) {
      this.mockData[entityType] = new Map();
    }
    
    const id = data.id || `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const entity = { ...data, id };
    this.mockData[entityType].set(id, entity);
    this._saveToStorage(entityType);
    
    // console.log(`Mock: Created entity with id ${id}`);
    return { success: true, id };
  }

  async updateEntity(entityType, id, data) {
    // console.log(`Mock: Updating entity ${entityType} with id ${id} and data:`, data);
    
    if (!this.mockData[entityType]) {
      this.mockData[entityType] = new Map();
    }
    
    const existing = this.mockData[entityType].get(id);
    if (existing) {
      const updated = { ...existing, ...data, id };
      this.mockData[entityType].set(id, updated);
      this._saveToStorage(entityType);
      // console.log(`Mock: Updated entity ${id}`);
    } else {
      // console.log(`Mock: Entity ${id} not found, creating new one`);
      const entity = { ...data, id };
      this.mockData[entityType].set(id, entity);
      this._saveToStorage(entityType);
    }
    
    return { success: true };
  }

  async deleteEntity(entityType, id) {
    // console.log(`Mock: Deleting entity ${entityType} with id ${id}`);
    
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
