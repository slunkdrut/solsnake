// Mock StateClient for development with in-memory persistence
function toFiniteNumber(value, fallback = 0) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export class StateClient {
  constructor(config) {
    this.baseURL = config.baseURL;
    this.appId = config.appId;
    this.apiBaseURL = (config.apiBaseURL || config.baseURL || '').replace(/\/$/, '');
    this.mockData = {
      daily_payments: new Map(),
      players: new Map(),
      daily_winners: new Map()
    };
    // Optional server persistence via API (/api/state).
    // Prefer the shared API when running in production (non-localhost) unless explicitly disabled.
    const envFlag = import.meta?.env?.VITE_USE_API_STORAGE;
    const isBrowser = typeof window !== 'undefined';
    let enableApi = false;
    if (isBrowser) {
      if (envFlag === '1') {
        enableApi = true;
      } else if (envFlag === '0') {
        enableApi = false;
      } else {
        const host = window.location?.hostname || '';
        const isLocalHost = !host || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local') || host.startsWith('192.168.') || host.startsWith('10.');
        enableApi = !isLocalHost;
      }
    }
    this.useApi = enableApi;
    this.apiFailed = false;
    this.apiWarned = false;
    this.persistenceWarned = false;
    console.log('Mock StateClient initialized with:', { ...config, useApi: this.useApi });
  }

  _handleLocalMutation(entityType, record, previous) {
    const dates = new Set();
    if (entityType === 'players' || entityType === 'daily_payments') {
      if (record?.date) dates.add(record.date);
      if (previous?.date) dates.add(previous.date);
    }
    for (const date of dates) {
      this._updateLocalDailyWinners(date);
    }
  }

  _updateLocalDailyWinners(date) {
    if (!date) return;
    const playersMap = this.mockData.players || new Map();
    const paymentsMap = this.mockData.daily_payments || new Map();
    const winnersMap = this.mockData.daily_winners || new Map();
    const players = Array.from(playersMap.values()).filter(entry => entry?.date === date);
    if (players.length === 0) {
      for (const [id, entry] of winnersMap) {
        if (entry?.date === date) {
          winnersMap.delete(id);
        }
      }
      return;
    }
    players.sort((a, b) => {
      const diff = toFiniteNumber(b?.score) - toFiniteNumber(a?.score);
      if (diff !== 0) return diff;
      return toFiniteNumber(a?.timestamp) - toFiniteNumber(b?.timestamp);
    });
    const topScore = toFiniteNumber(players[0]?.score);
    const topPlayers = players.filter(entry => toFiniteNumber(entry?.score) === topScore);
    const uniqueByWallet = new Map();
    for (const entry of topPlayers) {
      const wallet = entry?.wallet || 'Anonymous';
      if (!uniqueByWallet.has(wallet)) {
        uniqueByWallet.set(wallet, entry);
      }
    }
    const payments = Array.from(paymentsMap.values()).filter(entry => entry?.date === date);
    const total = payments.reduce((sum, payment) => sum + toFiniteNumber(payment?.amount), 0);
    const dailyPot = Math.max(0, total * 0.9);
    for (const [id, entry] of winnersMap) {
      if (entry?.date === date) {
        winnersMap.delete(id);
      }
    }
    const timestamp = Date.now();
    for (const [wallet, entry] of uniqueByWallet) {
      const winnerId = `winner_${date}_${wallet}`;
      winnersMap.set(winnerId, {
        id: winnerId,
        wallet,
        xUsername: entry?.xUsername || '',
        score: topScore,
        date,
        timestamp,
        dailyPot
      });
    }
    const firstWinner = uniqueByWallet.values().next().value;
    if (firstWinner) {
      const legacyId = `winner_${date}`;
      winnersMap.set(legacyId, {
        id: legacyId,
        wallet: firstWinner?.wallet || 'Anonymous',
        xUsername: firstWinner?.xUsername || '',
        score: topScore,
        date,
        timestamp,
        dailyPot
      });
    }
  }

  _shouldUseApi() {
    return this.useApi && !this.apiFailed && typeof fetch === 'function';
  }

  _handleApiFailure(error) {
    this.apiFailed = true;
    if (!this.apiWarned) {
      console.warn('StateClient: API unavailable, falling back to in-memory only', error);
      this.apiWarned = true;
    }
  }

  async _apiFetch(url, options = {}, expectJson = true) {
    if (!this._shouldUseApi()) {
      return undefined;
    }
    try {
      const targetUrl = (() => {
        if (/^https?:/i.test(url)) return url;
        if (this.apiBaseURL) {
          return `${this.apiBaseURL}${url.startsWith('/') ? url : `/${url}`}`;
        }
        return url;
      })();
      const response = await fetch(targetUrl, { cache: 'no-store', ...options });
      if (!response.ok) {
        let extra = '';
        try {
          const text = await response.text();
          if (text && text.length < 2048) {
            extra = ` body="${text}"`;
          }
        } catch (_) {
          // ignore body read issues
        }
        throw new Error(`API request failed with status ${response.status}${extra}`);
      }
      const persistence = response.headers?.get?.('x-solsnake-persistence');
      if (persistence && persistence !== 'kv' && !this.persistenceWarned) {
        console.warn('StateClient: backend reports non-persistent storage (', persistence, '). Leaderboards will reset between sessions until KV is configured.');
        this.persistenceWarned = true;
      }
      if (!expectJson) {
        return true;
      }
      return await response.json();
    } catch (error) {
      this._handleApiFailure(error);
      return undefined;
    }
  }

  async getEntities(entityType, filters = {}) {
    const params = new URLSearchParams({ type: entityType });
    if (filters.date) params.set('date', filters.date);
    const apiResult = await this._apiFetch(`/api/state?${params.toString()}`);
    if (apiResult !== undefined) {
      return Array.isArray(apiResult) ? apiResult : [];
    }
    if (!this.mockData[entityType]) return [];
    let entities = Array.from(this.mockData[entityType].values());
    if (filters.date) entities = entities.filter(e => e.date === filters.date);
    return entities;
  }

  async getEntity(entityType, id) {
    const params = new URLSearchParams({ type: entityType, id });
    const apiResult = await this._apiFetch(`/api/state?${params.toString()}`);
    if (apiResult !== undefined) {
      return apiResult;
    }
    if (!this.mockData[entityType]) return null;
    return this.mockData[entityType].get(id) || null;
  }

  async createEntity(entityType, data) {
    const apiOut = await this._apiFetch(`/api/state?type=${encodeURIComponent(entityType)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (apiOut !== undefined) {
      const id = apiOut?.id;
      if (id) {
        if (!this.mockData[entityType]) this.mockData[entityType] = new Map();
        this.mockData[entityType].set(id, { ...data, id });
        this._handleLocalMutation(entityType, { ...data, id }, null);
      }
      return apiOut;
    }
    if (!this.mockData[entityType]) this.mockData[entityType] = new Map();
    const id = data.id || `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const entity = { ...data, id };
    this.mockData[entityType].set(id, entity);
    this._handleLocalMutation(entityType, entity, null);
    return { success: true, id };
  }

  async updateEntity(entityType, id, data) {
    const params = new URLSearchParams({ type: entityType, id });
    const apiOut = await this._apiFetch(`/api/state?${params.toString()}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (apiOut !== undefined) {
      if (!this.mockData[entityType]) this.mockData[entityType] = new Map();
      const existing = this.mockData[entityType]?.get(id) || {};
      const updated = { ...existing, ...data, id };
      this.mockData[entityType].set(id, updated);
      this._handleLocalMutation(entityType, updated, existing);
      return apiOut;
    }
    if (!this.mockData[entityType]) this.mockData[entityType] = new Map();
    const existing = this.mockData[entityType].get(id);
    if (existing) {
      const updated = { ...existing, ...data, id };
      this.mockData[entityType].set(id, updated);
      this._handleLocalMutation(entityType, updated, existing);
    } else {
      const entity = { ...data, id };
      this.mockData[entityType].set(id, entity);
      this._handleLocalMutation(entityType, entity, null);
    }
    return { success: true };
  }

  async deleteEntity(entityType, id) {
    const params = new URLSearchParams({ type: entityType, id });
    const apiOut = await this._apiFetch(`/api/state?${params.toString()}`, { method: 'DELETE' });
    if (apiOut !== undefined) {
      const previous = this.mockData[entityType]?.get(id) || null;
      this.mockData[entityType]?.delete(id);
      this._handleLocalMutation(entityType, null, previous);
      return apiOut;
    }
    if (this.mockData[entityType]) {
      const previous = this.mockData[entityType].get(id) || null;
      this.mockData[entityType].delete(id);
      this._handleLocalMutation(entityType, null, previous);
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
