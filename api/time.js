// api/time.js
export default async function handler(req, res) {
    // CONFIG (override in Vercel env vars)
    const periodHours = Number(process.env.TOURNAMENT_PERIOD_HOURS || 24);
    const periodMs = periodHours * 60 * 60 * 1000;
  
    // Anchor the tournament day to a fixed epoch so it's stable and timezone-agnostic.
    // Example: local midnight in America/Edmonton on Sept 12, 2025.
    // Set this in Vercel project settings > Environment Variables for easy changes.
    const epochIso =
      process.env.TOURNAMENT_EPOCH_ISO || "2025-09-12T00:00:00-06:00";
  
    const now = Date.now();
    const epochMs = Date.parse(epochIso);
  
    // Safety: if epoch is in the future, use it anyway; math below still works.
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      now,
      epochMs,
      periodMs,
    });
  }
  