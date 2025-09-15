// api/state.js
// Simple persistence API for SolSnake using Vercel KV (Upstash)
// Requires env vars in Vercel:
// - KV_REST_API_URL
// - KV_REST_API_TOKEN
// The API stores items per entity type and maintains index sets for quick lookup.

async function readBody(req) {
  return await new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(Buffer.from(c)));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (_) { resolve({}); }
    });
  });
}

export default async function handler(req, res) {
  const { method, query } = req;
  const type = query.type; // 'players' | 'daily_payments' | 'daily_winners'

  if (!type) {
    res.status(400).json({ error: 'Missing type' });
    return;
  }

  // Dynamically import @vercel/kv only at runtime (keeps dev fast)
  let kv;
  try {
    const mod = await import('@vercel/kv');
    kv = mod.kv;
  } catch (e) {
    res.status(501).json({ error: 'KV not available. Add @vercel/kv and env vars.' });
    return;
  }

  const keyOf = (id) => `solsnake:${type}:${id}`;
  const setAll = `solsnake:${type}:all`;
  const setByDate = (date) => `solsnake:${type}:date:${date}`;

  try {
    if (method === 'GET') {
      const { id, date } = query;
      if (id) {
        const value = await kv.get(keyOf(id));
        res.status(200).json(value || null);
        return;
      }
      if (date) {
        const ids = await kv.smembers(setByDate(date));
        if (!ids || ids.length === 0) {
          res.status(200).json([]);
          return;
        }
        const pipeline = kv.pipeline();
        ids.forEach((i) => pipeline.get(keyOf(i)));
        const values = await pipeline.exec();
        res.status(200).json(values.filter(Boolean));
        return;
      }
      // Fallback: list all
      const ids = await kv.smembers(setAll);
      if (!ids || ids.length === 0) {
        res.status(200).json([]);
        return;
      }
      const pipeline = kv.pipeline();
      ids.forEach((i) => pipeline.get(keyOf(i)));
      const values = await pipeline.exec();
      res.status(200).json(values.filter(Boolean));
      return;
    }

    if (method === 'POST') {
      const body = typeof req.body === 'object' && req.body !== null ? req.body : await readBody(req);
      const id = body.id || `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const data = { ...body, id };
      await kv.set(keyOf(id), data);
      await kv.sadd(setAll, id);
      if (data.date) {
        await kv.sadd(setByDate(data.date), id);
      }
      res.status(200).json({ success: true, id });
      return;
    }

    if (method === 'PUT') {
      const { id } = query;
      if (!id) {
        res.status(400).json({ error: 'Missing id for update' });
        return;
      }
      const body = typeof req.body === 'object' && req.body !== null ? req.body : await readBody(req);
      const existing = await kv.get(keyOf(id));
      const data = { ...(existing || {}), ...(body || {}), id };
      await kv.set(keyOf(id), data);
      await kv.sadd(setAll, id);
      if (data.date) {
        await kv.sadd(setByDate(data.date), id);
      }
      res.status(200).json({ success: true });
      return;
    }

    if (method === 'DELETE') {
      const { id } = query;
      if (!id) {
        res.status(400).json({ error: 'Missing id for delete' });
        return;
      }
      await kv.del(keyOf(id));
      await kv.srem(setAll, id);
      // date index not removed (unknown date), harmless; can be rebuilt later
      res.status(200).json({ success: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Server error' });
  }
}
