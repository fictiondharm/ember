/**
 * End-to-end check of the golden demo flow, run against a live server.
 *
 *   npm run dev --prefix server      (terminal 1)
 *   npm test  --prefix server        (terminal 2)
 *
 * Verifies: seed determinism, capacity reservation arithmetic, state machine
 * transitions, incident handling, the approval gate, and that TWO independent
 * realtime clients both observe the same server-authoritative state.
 */
import WebSocket from 'ws';

const BASE = process.env.TEST_API_URL ?? 'http://localhost:4000';
const WS_URL = BASE.replace(/^http/, 'ws') + '/realtime';

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}`);
    if (detail !== undefined) console.log(`        ${JSON.stringify(detail)}`);
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

async function api<T = any>(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: T }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body: body as T };
}

class RealtimeClient {
  readonly name: string;
  readonly events: Array<{ type: string; payload: any }> = [];
  private socket: WebSocket;
  connected = false;

  constructor(name: string) {
    this.name = name;
    this.socket = new WebSocket(WS_URL);
    this.socket.on('open', () => {
      this.connected = true;
    });
    this.socket.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString()) as { type: string; payload: unknown };
        this.events.push({ type: parsed.type, payload: parsed.payload });
      } catch {
        /* ignore */
      }
    });
  }

  types(): string[] {
    return this.events.map((e) => e.type);
  }

  lastOfType(type: string): any | undefined {
    return [...this.events].reverse().find((e) => e.type === type)?.payload;
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve) => {
      if (this.socket.readyState === WebSocket.CLOSED) return resolve();
      this.socket.once('close', () => resolve());
      this.socket.close();
    });
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  console.log(`FleetGrid end-to-end flow test → ${BASE}`);

  section('1. Health + demo reset');
  const health = await api('/health');
  check('GET /health returns ok', health.status === 200 && health.body.status === 'ok', health.body);

  const reset = await api('/demo/reset', { method: 'POST' });
  check('POST /demo/reset succeeds', reset.status === 200, reset.body);

  const resetAgain = await api('/demo/reset', { method: 'POST' });
  check('POST /demo/reset is repeatable', resetAgain.status === 200, resetAgain.body);

  section('2. Deterministic seed');
  const trucks = await api('/trucks');
  const byId = new Map<string, any>(trucks.body.trucks.map((t: any) => [t.id, t]));
  check('FG-027 exists', byId.has('FG-027'));
  check('FG-027 is 5.0T capacity / 3.8T spare / AVAILABLE',
    byId.get('FG-027')?.capacityT === 5 && byId.get('FG-027')?.availableT === 3.8 && byId.get('FG-027')?.status === 'AVAILABLE',
    byId.get('FG-027'));
  check('FG-041 is 5.0T capacity / 3.1T spare', byId.get('FG-041')?.availableT === 3.1);
  check('FG-052 is 8.0T capacity / 5.0T spare', byId.get('FG-052')?.availableT === 5);
  check('All trucks route Bengaluru → Chennai',
    trucks.body.trucks.every((t: any) => t.origin === 'Bengaluru' && t.destination === 'Chennai'));

  const state1 = await api('/state');
  const demoLogin = await api('/auth/demo-login', {
    method: 'POST',
    body: JSON.stringify({ role: 'BUSINESS' }),
  });
  check('Demo login returns ABC Distributors for BUSINESS',
    demoLogin.status === 200 && demoLogin.body.organization?.name === 'ABC Distributors', demoLogin.body);
  const shipperId = demoLogin.body.organization.id;

  const driverLogin = await api('/auth/demo-login', { method: 'POST', body: JSON.stringify({ role: 'DRIVER' }) });
  check('Demo login returns Ravi Kumar on FG-027',
    driverLogin.body.user?.name === 'Ravi Kumar' && driverLogin.body.driver?.assignedTruckId === 'FG-027',
    driverLogin.body);
  const driverId = driverLogin.body.driver.id;

  section('3. Two realtime clients connect (Business laptop + Control Tower)');
  const tower = new RealtimeClient('control-tower');
  const business = new RealtimeClient('business');
  await sleep(400);
  check('Control Tower client connected', tower.connected);
  check('Business client connected', business.connected);
  check('Server accepted the hello frame', tower.types().includes('connected'));

  section('4. Business finds compatible capacity');
  const capacity = await api('/capacity?origin=Bengaluru&destination=Chennai&weightT=1');
  check('GET /capacity returns 3 compatible offers', capacity.body.count === 3, capacity.body);
  const fg027 = capacity.body.matches.find((m: any) => m.truck.id === 'FG-027');
  check('FG-027 offered at 3.8T spare on Bengaluru → Chennai',
    fg027?.truck.availableT === 3.8 && fg027?.route === 'Bengaluru → Chennai', fg027);

  section('5. Validation rejects bad input');
  const badWeight = await api('/shipments', {
    method: 'POST',
    body: JSON.stringify({ shipperId, cargoName: 'Bad', origin: 'Bengaluru', destination: 'Chennai', weightT: 0 }),
  });
  check('Zero weight is rejected with 400', badWeight.status === 400, badWeight.body);

  const unknownTruck = await api('/trucks/FG-999/depart', { method: 'POST', body: JSON.stringify({}) });
  check('Departing a non-existent truck returns 404', unknownTruck.status === 404, unknownTruck.body);

  const unknownIncident = await api('/incidents', {
    method: 'POST',
    body: JSON.stringify({ truckId: 'FG-999', type: 'TRUCK_BREAKDOWN', location: 'Hosur' }),
  });
  check('Incident for a non-existent truck returns 404', unknownIncident.status === 404, unknownIncident.body);

  const oversell = await api('/shipments', {
    method: 'POST',
    body: JSON.stringify({
      shipperId,
      cargoName: 'Too Heavy',
      origin: 'Bengaluru',
      destination: 'Chennai',
      weightT: 99,
      capacityOfferId: fg027.offer.id,
    }),
  });
  check('Weight above the demo limit is rejected', oversell.status === 400, oversell.body);

  const tooMuch = await api('/shipments', {
    method: 'POST',
    body: JSON.stringify({
      shipperId,
      cargoName: 'Too Heavy',
      origin: 'Bengaluru',
      destination: 'Chennai',
      weightT: 4.5,
      capacityOfferId: fg027.offer.id,
    }),
  });
  check('Reserving 4.5T on a 3.8T truck is rejected with 422', tooMuch.status === 422, tooMuch.body);

  const wrongRoute = await api('/shipments', {
    method: 'POST',
    body: JSON.stringify({
      shipperId,
      cargoName: 'Wrong Route',
      origin: 'Mysuru',
      destination: 'Chennai',
      weightT: 1,
      capacityOfferId: fg027.offer.id,
    }),
  });
  check('Mismatched pickup city is rejected with 422', wrongRoute.status === 422, wrongRoute.body);

  section('6. Business creates the 1T shipment on FG-027');
  const created = await api('/shipments', {
    method: 'POST',
    body: JSON.stringify({
      shipperId,
      cargoName: 'ABC Electronics',
      origin: 'Bengaluru',
      destination: 'Chennai',
      weightT: 1,
      actorId: demoLogin.body.user.id,
      capacityOfferId: fg027.offer.id,
    }),
  });
  check('POST /shipments returns 201', created.status === 201, created.body);
  const shipmentId = created.body.shipment?.id as string;
  check('Shipment is CONFIRMED', created.body.shipment?.status === 'CONFIRMED', created.body.shipment);
  check('Shipment is on FG-027', created.body.shipment?.truckId === 'FG-027');
  check('Shipment price is 850 INR for 1T', created.body.shipment?.price === 850, created.body.shipment);

  await sleep(300);
  const afterReserve = await api('/trucks/FG-027');
  check('FG-027 spare capacity dropped 3.8T → 2.8T', afterReserve.body.truck.availableT === 2.8, afterReserve.body.truck);
  check('FG-027 is now ASSIGNED', afterReserve.body.truck.status === 'ASSIGNED', afterReserve.body.truck);
  check('FG-027 capacity offer shows 2.8T', afterReserve.body.capacityOffer?.availableT === 2.8, afterReserve.body.capacityOffer);

  check('Control Tower received shipment.created', tower.types().includes('shipment.created'), tower.types());
  check('Control Tower received truck.updated', tower.types().includes('truck.updated'), tower.types());
  check('Control Tower received capacity.updated', tower.types().includes('capacity.updated'), tower.types());
  check('Control Tower saw the confirmed shipment',
    tower.lastOfType('shipment.updated')?.id === shipmentId, tower.lastOfType('shipment.updated'));

  section('7. Driver starts the journey');
  const depart = await api('/trucks/FG-027/depart', { method: 'POST', body: JSON.stringify({ driverId }) });
  check('POST /trucks/FG-027/depart succeeds', depart.status === 200, depart.body);
  check('FG-027 is IN_TRANSIT', depart.body.truckStatus === 'IN_TRANSIT', depart.body);
  check('Shipment is IN_TRANSIT', depart.body.shipments?.[0]?.status === 'IN_TRANSIT', depart.body.shipments);

  await sleep(300);
  const afterDepart = await api('/state');
  const ctShipment = afterDepart.body.shipments.find((s: any) => s.id === shipmentId);
  check('Server state: shipment IN_TRANSIT', ctShipment?.status === 'IN_TRANSIT', ctShipment);
  const ctTruck = afterDepart.body.trucks.find((t: any) => t.id === 'FG-027');
  check('Server state: FG-027 IN_TRANSIT', ctTruck?.status === 'IN_TRANSIT', ctTruck);
  check('Control Tower saw truck.updated → IN_TRANSIT',
    tower.lastOfType('truck.updated')?.id === 'FG-027' && tower.lastOfType('truck.updated')?.status === 'IN_TRANSIT',
    tower.lastOfType('truck.updated'));

  section('8. Driver reports a Hosur breakdown');
  const earlyIncident = await api('/incidents', {
    method: 'POST',
    body: JSON.stringify({ truckId: 'FG-041', type: 'TRUCK_BREAKDOWN', location: 'Hosur' }),
  });
  check('Incident on a non-departed truck is rejected with 409', earlyIncident.status === 409, earlyIncident.body);

  const incident = await api('/incidents', {
    method: 'POST',
    body: JSON.stringify({
      truckId: 'FG-027',
      type: 'TRUCK_BREAKDOWN',
      location: 'Hosur',
      description: 'Engine failure / truck unable to continue',
      actorId: driverId,
    }),
  });
  check('POST /incidents returns 201', incident.status === 201, incident.body);
  const incidentId = incident.body.incident?.id as string;
  check('Incident is OPEN', incident.body.incident?.status === 'OPEN', incident.body.incident);
  check('Incident location resolved to Hosur', incident.body.incident?.location === 'Hosur');
  check('Incident severity defaulted to HIGH', incident.body.incident?.severity === 'HIGH');
  check('Affected shipment is AT_RISK', incident.body.affectedShipments?.[0]?.status === 'AT_RISK', incident.body.affectedShipments);
  check('Truck is INCIDENT', incident.body.truck?.status === 'INCIDENT', incident.body.truck);

  await sleep(300);
  check('Control Tower received incident.created', tower.types().includes('incident.created'), tower.types());
  const towerIncident = tower.lastOfType('incident.created');
  check('Control Tower incident names FG-027 / Truck breakdown / Hosur',
    towerIncident?.truckId === 'FG-027' && towerIncident?.location === 'Hosur' && towerIncident?.type === 'TRUCK_BREAKDOWN',
    towerIncident);
  check('Business client also received the incident', business.types().includes('incident.created'), business.types());

  const postIncidentState = await api('/state');
  const atRisk = postIncidentState.body.shipments.find((s: any) => s.id === shipmentId);
  check('Server state: shipment AT_RISK', atRisk?.status === 'AT_RISK', atRisk);

  section('9. Recovery: deterministic options + approval gate');
  const options = await api(`/incidents/${incidentId}/recovery-options`);
  check('Two compatible candidates returned',
    options.body.options.filter((o: any) => o.compatible).length === 2, options.body.options);
  const fg041 = options.body.options.find((o: any) => o.truckId === 'FG-041');
  const fg052 = options.body.options.find((o: any) => o.truckId === 'FG-052');
  check('FG-041 candidate: 3.1T spare, 8.2 km, 17 min',
    fg041?.compatible && fg041?.availableT === 3.1 && fg041?.distanceKm === 8.2 && fg041?.etaMinutes === 17, fg041);
  check('FG-052 candidate: 5.0T spare, 15.8 km, 26 min',
    fg052?.compatible && fg052?.availableT === 5 && fg052?.distanceKm === 15.8 && fg052?.etaMinutes === 26, fg052);
  check('FG-027 is not offered as its own recovery truck',
    !options.body.options.some((o: any) => o.truckId === 'FG-027'));

  const plan = await api('/recovery-plans', { method: 'POST', body: JSON.stringify({ incidentId }) });
  check('POST /recovery-plans returns 201', plan.status === 201, plan.body);
  const planId = plan.body.plan?.id as string;
  check('Plan is PENDING_APPROVAL', plan.body.plan?.status === 'PENDING_APPROVAL', plan.body.plan);
  check('Plan selected FG-041 (fastest compatible)', plan.body.plan?.selectedTruckId === 'FG-041', plan.body.plan);

  const bypass = await api(`/recovery-plans/${planId}/execute`, { method: 'POST', body: JSON.stringify({}) });
  check('Execution before approval is blocked with 409', bypass.status === 409, bypass.body);
  const stillPending = await api(`/recovery-plans/${planId}`);
  check('Shipment still AT_RISK after blocked execution',
    (await api('/state')).body.shipments.find((s: any) => s.id === shipmentId)?.status === 'AT_RISK');
  check('Plan still PENDING_APPROVAL after blocked execution', stillPending.body.plan?.status === 'PENDING_APPROVAL');

  const approved = await api(`/recovery-plans/${planId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approvedBy: 'operator_demo' }),
  });
  check('Approve moves plan to APPROVED', approved.body.plan?.status === 'APPROVED', approved.body);

  const executed = await api(`/recovery-plans/${planId}/execute`, {
    method: 'POST',
    body: JSON.stringify({ executedBy: 'operator_demo' }),
  });
  check('Execute succeeds', executed.status === 200, executed.body);
  check('Plan is COMPLETED', executed.body.plan?.status === 'COMPLETED', executed.body.plan);
  check('Shipment moved onto FG-041', executed.body.reassignments?.[0]?.toTruckId === 'FG-041', executed.body.reassignments);
  check('Verification readback shows shipment IN_TRANSIT',
    executed.body.verification?.shipmentStatus === 'IN_TRANSIT', executed.body.verification);
  check('Verification readback shows FG-041 has 2.1T spare',
    executed.body.verification?.toTruckAvailableT === 2.1, executed.body.verification);

  const repeat = await api(`/recovery-plans/${planId}/execute`, { method: 'POST', body: JSON.stringify({}) });
  check('Re-executing a completed plan is idempotent', repeat.status === 200 && repeat.body.alreadyExecuted === true, repeat.body);

  const finalState = await api('/state');
  const finalTruck027 = finalState.body.trucks.find((t: any) => t.id === 'FG-027');
  const finalTruck041 = finalState.body.trucks.find((t: any) => t.id === 'FG-041');
    check('FG-027 recovered its 1T → 3.8T spare and returned to service',
      finalTruck027?.availableT === 3.8 && finalTruck027?.status === 'AVAILABLE', finalTruck027);
    const finalDriver027 = finalState.body.drivers.find((d: any) => d.assignedTruckId === 'FG-027');
    check('FG-027 driver released back to AVAILABLE',
      finalDriver027?.status === 'AVAILABLE', finalDriver027);
  check('FG-041 spent 1.0T → 2.1T spare', finalTruck041?.availableT === 2.1, finalTruck041);
  check('Incident resolved', finalState.body.incidents.find((i: any) => i.id === incidentId)?.status === 'RESOLVED');

  section('10. Timeline + proof honesty');
  const timeline = await api(`/shipments/${shipmentId}/timeline`);
  const eventTypes = timeline.body.events.map((e: any) => e.eventType);
  check('Timeline records shipment.created', eventTypes.includes('shipment.created'), eventTypes);
  check('Timeline records shipment.capacity_reserved', eventTypes.includes('shipment.capacity_reserved'));
  check('Timeline records shipment.confirmed', eventTypes.includes('shipment.confirmed'));
  check('Timeline records shipment.departed', eventTypes.includes('shipment.departed'));
  check('Timeline records incident.created', eventTypes.includes('incident.created'));
  check('Timeline records cargo.handoff', eventTypes.includes('cargo.handoff'), eventTypes);
  check('Every event is hashed', timeline.body.events.every((e: any) => typeof e.hash === 'string' && e.hash.length === 64));
  check('No event fakes a blockchain confirmation',
    timeline.body.events.every((e: any) => e.proofStatus !== 'CONFIRMED' && e.blockchainTx === null));

  const badEvent = await api('/events', { method: 'POST', body: JSON.stringify({ eventType: 'Bad Type!' }) });
  check('Invalid eventType is rejected with 400', badEvent.status === 400, badEvent.body);
  const goodEvent = await api('/events', {
    method: 'POST',
    body: JSON.stringify({ eventType: 'shipment.note', shipmentId, payload: { note: 'demo' } }),
  });
  check('Valid event is appended with a hash', goodEvent.status === 201 && goodEvent.body.event.hash.length === 64, goodEvent.body);

  section('11. Reset restores the exact demo state');
  await api('/demo/reset', { method: 'POST' });
  const afterReset = await api('/state');
  const t027 = afterReset.body.trucks.find((t: any) => t.id === 'FG-027');
  check('Reset: FG-027 back to 3.8T / AVAILABLE', t027?.availableT === 3.8 && t027?.status === 'AVAILABLE', t027);
  check('Reset: no live incidents', afterReset.body.incidents.filter((i: any) => i.status === 'OPEN').length === 0);
  check('Reset: only the two seeded historical shipments remain', afterReset.body.shipments.length === 2, afterReset.body.shipments.length);
  check('Reset: no recovery plans', afterReset.body.recoveryPlans.length === 0);
  check('Reset broadcast reached Control Tower', tower.types().includes('demo.reset'), tower.types());

  await tower.close();
  await business.close();

  console.log(`\n${'='.repeat(56)}`);
  console.log(`  passed: ${passed}   failed: ${failed}`);
  console.log('='.repeat(56));
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nTest run crashed:', err);
  process.exit(1);
});
