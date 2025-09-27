// api/time.js
export default async function handler(req, res) {
  // CONFIG (override in Vercel env vars)
  const periodHours = Number(process.env.TOURNAMENT_PERIOD_HOURS || 24);
  const periodMs = periodHours * 60 * 60 * 1000;

  // Anchor the tournament day to a fixed epoch so it's stable and timezone-agnostic.
  // Reset is anchored to 23:00 UTC each day (5:00 PM Mountain Time; adjust via env for DST if needed).
  // Override via Vercel env: TOURNAMENT_EPOCH_ISO if you need to shift (e.g., "2024-06-01T23:00:00Z").
  const epochIso = process.env.TOURNAMENT_EPOCH_ISO || "2024-01-01T23:00:00Z";

  const now = Date.now();
  const epochMs = Date.parse(epochIso);

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ now, epochMs, periodMs });
}
