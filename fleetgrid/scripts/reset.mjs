/** Resets the demo dataset through the API. Requires the server to be running. */
const base = process.env.FLEETGRID_API ?? 'http://localhost:4000';

const res = await fetch(`${base}/demo/reset`, { method: 'POST' });
const body = await res.json().catch(() => null);

if (!res.ok) {
  console.error(`Reset failed (HTTP ${res.status}). Is the server running on ${base}?`);
  if (body) console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}

console.log('Demo state reset:');
console.log(`  trucks:    ${body.trucks ?? 0} (FG-027 3.8T, FG-041 3.1T, FG-052 5.0T spare)`);
console.log(`  shipments: ${body.shipments ?? 0} (historical, delivered)`);
console.log(`  incidents: 0 live, recovery plans: 0`);
