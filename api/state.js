import { createClient } from '@vercel/kv';

const ALLOWED_TYPES = new Set(['players', 'daily_payments', 'daily_winners', 'health']);
const KEY_PREFIX = process.env.STATE_KEY_PREFIX || 'solsnake:v1';

function normalizeEnv(value) {
  if (!value) return null;
  const trimmed = `${value}`.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

const KV_REST_API_URL = normalizeEnv(
  process.env.KV_REST_API_URL
  || process.env.UPSTASH_REST_URL
  || process.env.UPSTASH_REDIS_REST_URL
  || process.env.UPSTASH_KV_REST_URL
);

const KV_REST_API_TOKEN = normalizeEnv(
  process.env.KV_REST_API_TOKEN
  || process.env.UPSTASH_REST_TOKEN
  || process.env.UPSTASH_REDIS_REST_TOKEN
  || process.env.UPSTASH_KV_REST_TOKEN
);

const KV_ENABLED = Boolean(KV_REST_API_URL && KV_REST_API_TOKEN);

const kvClient = KV_ENABLED
  ? createClient({ url: KV_REST_API_URL, token: KV_REST_API_TOKEN })
  : null;

if (KV_ENABLED) {
  console.log('[state] KV enabled via', KV_REST_API_URL);
}

if (!KV_ENABLED) {
  console.warn('[state] KV disabled – falling back to in-memory storage only. Set KV_REST_API_URL/KV_REST_API_TOKEN to enable global persistence.');
}

const memoryStore = globalThis.__SOLSN_MEMORY__ ||= {};
for (const type of ALLOWED_TYPES) {
  if (!memoryStore[type]) {
    memoryStore[type] = new Map();
  }
}

function keyFor(type) {
  return `${KEY_PREFIX}:${type}`;
}

function parseJson(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }
  return raw;
}

async function storeGet(type, id) {
  if (KV_ENABLED) {
    const raw = await kvClient.hget(keyFor(type), id);
    return parseJson(raw);
  }
  return memoryStore[type].get(id) || null;
}

async function storeSet(type, id, value) {
  if (KV_ENABLED) {
    await kvClient.hset(keyFor(type), { [id]: JSON.stringify(value) });
  } else {
    memoryStore[type].set(id, value);
  }
}

async function storeDelete(type, id) {
  if (KV_ENABLED) {
    await kvClient.hdel(keyFor(type), id);
  } else {
    memoryStore[type].delete(id);
  }
}

async function storeAll(type) {
  if (KV_ENABLED) {
    const raw = await kvClient.hgetall(keyFor(type));
    if (!raw) return [];
    return Object.values(raw).map(parseJson).filter(Boolean);
  }
  return Array.from(memoryStore[type].values());
}

function toFiniteNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function ensureId(data) {
  if (data.id) return data.id;
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function computeDailyPot(date) {
  if (!date) return 0;
  const payments = await storeAll('daily_payments');
  const total = payments
    .filter(payment => payment?.date === date)
    .reduce((sum, payment) => sum + toFiniteNumber(payment?.amount), 0);
  const pot = total * 0.9;
  return Math.max(0, pot);
}

async function removeWinnersForDate(date) {
  if (!date) return;
  const winners = await storeAll('daily_winners');
  for (const entry of winners) {
    if (entry?.date === date && entry?.id) {
      await storeDelete('daily_winners', entry.id);
    }
  }
}

async function recomputeDailyWinners(date) {
  if (!date) return;
  const players = await storeAll('players');
  const relevant = players
    .filter(player => player?.date === date)
    .map(player => ({ ...player, score: toFiniteNumber(player.score) }))
    .filter(player => Number.isFinite(player.score));
  if (relevant.length === 0) {
    await removeWinnersForDate(date);
    return;
  }
  relevant.sort((a, b) => {
    const diff = toFiniteNumber(b.score) - toFiniteNumber(a.score);
    if (diff !== 0) return diff;
    return toFiniteNumber(a.timestamp) - toFiniteNumber(b.timestamp);
  });
  const topEntry = relevant[0];
  const wallet = topEntry.wallet || 'Anonymous';
  const xUsername = topEntry.xUsername || '';
  const topScore = topEntry.score;

  const dailyPot = await computeDailyPot(date);
  const timestamp = Date.now();
  const payloads = [{
    id: `winner_${date}_${wallet}`,
    wallet,
    xUsername,
    score: topScore,
    date,
    timestamp,
    dailyPot
  }, {
    id: `winner_${date}`,
    wallet,
    xUsername,
    score: topScore,
    date,
    timestamp,
    dailyPot
  }];
  const existing = await storeAll('daily_winners');
  const keep = new Set(payloads.map(entry => entry.id));
  for (const entry of payloads) {
    await storeSet('daily_winners', entry.id, entry);
  }
  for (const entry of existing) {
    if (entry?.date === date && entry?.id && !keep.has(entry.id)) {
      await storeDelete('daily_winners', entry.id);
    }
  }
}

async function afterWrite(type, record, previous = null) {
  if (type === 'players' || type === 'daily_payments') {
    const dates = new Set();
    if (record?.date) dates.add(record.date);
    if (previous?.date) dates.add(previous.date);
  }
}

async function afterDelete(type, previous = null) {
}

async function createEntity(type, data) {
  const id = ensureId(data);
  const record = { ...data, id };
  await storeSet(type, id, record);
  await afterWrite(type, record, null);
  return { success: true, id };
}

async function updateEntity(type, id, patch) {
  const previous = await storeGet(type, id);
  const base = previous || { id };
  const record = { ...base, ...patch, id };
  await storeSet(type, id, record);
  await afterWrite(type, record, previous);
  return { success: true };
}

async function deleteEntity(type, id) {
  const previous = await storeGet(type, id);
  await storeDelete(type, id);
  await afterDelete(type, previous);
  return { success: true };
}

function badRequest(res, message) {
  res.status(400).json({ error: message });
}

async function readJson(req) {
  if (req.body) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch (_) {
        return {};
      }
    }
    return req.body;
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (_) {
    return {};
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Solsnake-Persistence', KV_ENABLED ? 'kv' : 'memory');
  const url = new URL(req.url, 'http://localhost');
  const type = url.searchParams.get('type');
  if (!type || !ALLOWED_TYPES.has(type)) {
    badRequest(res, 'invalid type');
    return;
  }
  const id = url.searchParams.get('id');
  const dateFilter = url.searchParams.get('date');

  if (type === 'health') {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'method not allowed' });
      return;
    }
    if (!KV_ENABLED) {
      res.status(200).json({
        ok: false,
        persistence: 'memory',
        reason: 'missing credentials',
        credentials: {
          urlPresent: Boolean(KV_REST_API_URL),
          tokenPresent: Boolean(KV_REST_API_TOKEN)
        }
      });
      return;
    }
    try {
      const probeKey = `health:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      const namespacedProbe = `${KEY_PREFIX}:${probeKey}`;
      await kvClient.set(namespacedProbe, 'ok', { ex: 30 });
      const counts = {};
      try {
        counts.players = await kvClient.hlen(keyFor('players'));
      } catch (_) {
        counts.players = null;
      }
      try {
        counts.dailyPayments = await kvClient.hlen(keyFor('daily_payments'));
      } catch (_) {
        counts.dailyPayments = null;
      }
      try {
        counts.dailyWinners = await kvClient.hlen(keyFor('daily_winners'));
      } catch (_) {
        counts.dailyWinners = null;
      }
      res.status(200).json({
        ok: true,
        persistence: 'kv',
        counts,
        credentials: {
          urlPresent: true,
          tokenPresent: true
        }
      });
    } catch (error) {
      const message = error?.message || 'unknown error';
      res.status(500).json({
        ok: false,
        persistence: 'kv',
        error: message
      });
    }
    return;
  }

  try {
    if (req.method === 'GET') {
      if (id) {
        const entity = await storeGet(type, id);
        res.status(200).json(entity || null);
        return;
      }
      let entities = await storeAll(type);
      if (dateFilter) {
        entities = entities.filter(entry => entry?.date === dateFilter);
      }
      entities.sort((a, b) => toFiniteNumber(b?.timestamp) - toFiniteNumber(a?.timestamp));
      res.status(200).json(entities);
      return;
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      const result = await createEntity(type, body || {});
      res.status(200).json(result);
      return;
    }

    if (req.method === 'PUT') {
      if (!id) {
        badRequest(res, 'missing id');
        return;
      }
      const body = await readJson(req);
      const result = await updateEntity(type, id, body || {});
      res.status(200).json(result);
      return;
    }

    if (req.method === 'DELETE') {
      if (!id) {
        badRequest(res, 'missing id');
        return;
      }
      const result = await deleteEntity(type, id);
      res.status(200).json(result);
      return;
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (error) {
    const message = error?.message || 'unknown error';
    const details = error?.response?.data || error?.stack || null;
    const lower = message.toLowerCase();
    const unauthorized = lower.includes('wrongpass') || lower.includes('missing auth token') || lower.includes('unauthorized');
    const statusCode = unauthorized ? 401 : 500;
    console.error('state handler error', message, details);
    res.status(statusCode).json({ error: 'internal error', message, statusCode });
  }
}
