/**
 * Formal JSON Schema (draft 2020-12) for the agent tool contract — Master PRD §11,
 * and the input/output schema deliverable in the Agent 1 workstream PRD.
 *
 * This is the machine-readable artifact a model or an external tool-runner can be
 * given directly. It is hand-authored rather than generated from the Zod schemas so
 * the published contract has no extra runtime dependency, and `flow.test.ts` asserts
 * it stays in step with `TOOL_CATALOG` (same names, same READY/PLACEHOLDER status),
 * which is the drift that actually matters.
 *
 * Honesty rules encoded here, matching the coding agent contract:
 * - tools marked PLACEHOLDER have no success schema, because they cannot succeed yet;
 * - `anchor_proof` output can never contain a fabricated transaction hash.
 */

export const AGENT_TOOL_SCHEMA_ID = 'https://fleetgrid.dev/schemas/agent-tools/1.0.0';

const nullableString = { type: ['string', 'null'] } as const;

export const AGENT_TOOL_JSON_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: AGENT_TOOL_SCHEMA_ID,
  title: 'FleetGrid agent tool contract',
  description:
    'The only mutation path available to the recovery agent (Master PRD §9/§11). The agent receives no database handle: every state change goes through one of these tools, each of which validates input and enforces the server-side state machine.',
  type: 'object',
  required: ['tools'],
  additionalProperties: false,
  properties: {
    tools: {
      type: 'array',
      minItems: 1,
      items: { $ref: '#/$defs/tool' },
    },
  },
  $defs: {
    tool: {
      type: 'object',
      required: ['name', 'purpose', 'status', 'input'],
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        purpose: { type: 'string' },
        status: { type: 'string', enum: ['READY', 'PLACEHOLDER'] },
        validates: { type: 'string' },
        input: { $ref: '#/$defs/schema' },
        output: { $ref: '#/$defs/schema' },
        unavailable: { $ref: '#/$defs/schema' },
      },
      allOf: [
        {
          description: 'A PLACEHOLDER tool declares why it cannot run, and no success output.',
          if: { properties: { status: { const: 'PLACEHOLDER' } }, required: ['status'] },
          then: {
            required: ['unavailable'],
            not: { required: ['output'] },
          },
        },
      ],
    },

    /** A JSON Schema describing one tool's arguments or result. */
    schema: {
      type: 'object',
      required: ['type'],
      properties: {
        type: { type: 'string' },
        description: { type: 'string' },
        required: { type: 'array', items: { type: 'string' } },
        properties: { type: 'object' },
        items: { type: 'object' },
        enum: { type: 'array' },
        additionalProperties: { type: 'boolean' },
      },
    },

    /** Envelope every tool returns on success. */
    toolResult: {
      type: 'object',
      required: ['ok', 'tool', 'data'],
      additionalProperties: false,
      properties: {
        ok: { const: true },
        tool: { type: 'string' },
        data: { type: 'object' },
      },
    },

    /** Envelope every tool throws on failure. */
    toolError: {
      type: 'object',
      required: ['ok', 'error'],
      additionalProperties: false,
      properties: {
        ok: { const: false },
        error: {
          type: 'object',
          required: ['code', 'message'],
          properties: {
            code: {
              type: 'string',
              enum: ['BAD_REQUEST', 'NOT_FOUND', 'CONFLICT', 'UNPROCESSABLE', 'NOT_IMPLEMENTED', 'INTERNAL'],
            },
            message: { type: 'string' },
            details: { type: ['object', 'null'] },
          },
        },
      },
    },

    truck: {
      type: 'object',
      required: ['id', 'organizationId', 'registrationNo', 'capacityT', 'availableT', 'status', 'origin', 'destination'],
      properties: {
        id: { type: 'string', examples: ['FG-027'] },
        organizationId: { type: 'string' },
        registrationNo: { type: 'string' },
        capacityT: { type: 'number', description: 'Rated payload in tonnes.' },
        availableT: { type: 'number', description: 'Spare tonnes right now. Never negative.' },
        status: { $ref: '#/$defs/truckStatus' },
        lat: { type: 'number' },
        lng: { type: 'number' },
        origin: { type: 'string' },
        destination: { type: 'string' },
        departureAt: nullableString,
        driverId: nullableString,
        createdAt: { type: 'string', format: 'date-time' },
      },
    },

    truckStatus: {
      type: 'string',
      enum: ['AVAILABLE', 'ASSIGNED', 'LOADING', 'IN_TRANSIT', 'DELIVERED', 'DELAYED', 'INCIDENT', 'RECOVERY'],
    },

    shipment: {
      type: 'object',
      required: ['id', 'cargoName', 'shipperId', 'origin', 'destination', 'weightT', 'status', 'price', 'currency'],
      properties: {
        id: { type: 'string', examples: ['SHP-1002'] },
        reference: { type: 'string' },
        cargoName: { type: 'string' },
        shipperId: { type: 'string' },
        origin: { type: 'string' },
        destination: { type: 'string' },
        weightT: { type: 'number' },
        deadlineAt: nullableString,
        status: { $ref: '#/$defs/shipmentStatus' },
        truckId: nullableString,
        capacityOfferId: nullableString,
        price: { type: 'number' },
        currency: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },

    shipmentStatus: {
      type: 'string',
      enum: ['DRAFT', 'CAPACITY_RESERVED', 'CONFIRMED', 'IN_TRANSIT', 'AT_RISK', 'RECOVERY', 'DELIVERED'],
    },

    capacityOffer: {
      type: 'object',
      required: ['id', 'truckId', 'route', 'origin', 'destination', 'availableT', 'status', 'pricePerT'],
      properties: {
        id: { type: 'string' },
        truckId: { type: 'string' },
        route: { type: 'string', examples: ['Bengaluru → Chennai'] },
        origin: { type: 'string' },
        destination: { type: 'string' },
        availableT: { type: 'number' },
        departureAt: nullableString,
        status: { type: 'string', enum: ['OPEN', 'HELD', 'CLOSED'] },
        priceRule: { type: 'string', examples: ['DEMO_PER_TONNE'] },
        pricePerT: { type: 'number', description: 'Demo estimate, not a carrier quote.' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },

    incident: {
      type: 'object',
      required: ['id', 'truckId', 'type', 'location', 'severity', 'status', 'source', 'affectedShipmentIds'],
      properties: {
        id: { type: 'string' },
        truckId: { type: 'string' },
        type: {
          type: 'string',
          enum: ['TRUCK_BREAKDOWN', 'ACCIDENT', 'DELAY', 'CARGO_DAMAGE', 'ROUTE_BLOCKED', 'OTHER'],
        },
        location: { type: 'string' },
        severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
        transcript: { type: 'string', description: 'Driver transcript, text path today.' },
        structuredSummary: { type: 'string' },
        status: { type: 'string', enum: ['OPEN', 'ANALYZING', 'PLAN_READY', 'RESOLVED', 'ESCALATED'] },
        source: { type: 'string', enum: ['DRIVER_APP', 'VOICE', 'OPERATOR', 'SYSTEM'] },
        affectedShipmentIds: { type: 'array', items: { type: 'string' } },
        recoveryPlanId: nullableString,
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },

    recoveryOption: {
      type: 'object',
      required: ['truckId', 'availableT', 'etaMinutes', 'distanceKm', 'cost', 'currency', 'compatible', 'reason'],
      properties: {
        truckId: { type: 'string' },
        availableT: { type: 'number' },
        etaMinutes: { type: 'number', description: 'Deterministic demo estimate.' },
        distanceKm: { type: 'number', description: 'Deterministic demo estimate.' },
        cost: { type: 'number' },
        currency: { type: 'string' },
        compatible: { type: 'boolean' },
        reason: { type: 'string', description: 'Operational justification, not hidden reasoning.' },
      },
    },

    recoveryPlan: {
      type: 'object',
      required: ['id', 'incidentId', 'affectedShipmentIds', 'options', 'status', 'createdAt', 'updatedAt'],
      properties: {
        id: { type: 'string' },
        incidentId: { type: 'string' },
        affectedShipmentIds: { type: 'array', items: { type: 'string' } },
        options: { type: 'array', items: { $ref: '#/$defs/recoveryOption' } },
        selectedTruckId: nullableString,
        cost: { type: 'number' },
        etaDeltaMinutes: { type: 'number' },
        status: {
          type: 'string',
          enum: ['DRAFT', 'PROPOSED', 'PENDING_APPROVAL', 'APPROVED', 'EXECUTING', 'COMPLETED', 'REJECTED'],
        },
        approvedBy: nullableString,
        approvedAt: nullableString,
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },

    shipmentEvent: {
      type: 'object',
      required: ['id', 'eventType', 'payload', 'actorType', 'timestamp', 'hash', 'proofStatus'],
      properties: {
        id: { type: 'string' },
        shipmentId: nullableString,
        incidentId: nullableString,
        truckId: nullableString,
        eventType: { type: 'string' },
        payload: { type: 'object' },
        actorType: { type: 'string', enum: ['SYSTEM', 'AGENT', 'OPERATOR', 'DRIVER', 'BUSINESS'] },
        actorId: nullableString,
        timestamp: { type: 'string', format: 'date-time' },
        hash: { type: 'string', description: 'SHA-256 over the canonical event body.' },
        blockchainTx: nullableString,
        proofStatus: { type: 'string', enum: ['NOT_ANCHORED', 'PENDING', 'CONFIRMED', 'FAILED'] },
      },
    },

    notification: {
      type: 'object',
      required: ['id', 'recipientId', 'type', 'message', 'status', 'createdAt'],
      properties: {
        id: { type: 'string' },
        recipientId: { type: 'string' },
        type: { type: 'string' },
        message: { type: 'string' },
        status: { type: 'string', enum: ['PENDING', 'SENT'] },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  },
} as const;

const single = (description: string, type: string) => ({ type, description });
const ref = (name: string) => ({ $ref: `#/$defs/${name}` });
const refArray = (name: string) => ({ type: 'array', items: ref(name) });
const notImplemented = (what: string, nextStep: string) => ({
  type: 'object',
  description: `Always fails. ${what}`,
  required: ['ok', 'error'],
  properties: {
    ok: { const: false },
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: { const: 'NOT_IMPLEMENTED' },
        message: { type: 'string' },
        details: { type: 'object' },
      },
    },
    nextStep: { type: 'string', description: nextStep },
  },
});

/**
 * One entry per tool in `TOOL_CATALOG`, in the same order.
 *
 * Read tools return authoritative backend data. The mutation tools are the only
 * way the agent can change anything.
 */
export const AGENT_TOOL_SCHEMA_ENTRIES = [
  {
    name: 'get_truck',
    purpose: 'Read current truck/capacity/location/status',
    status: 'READY',
    validates: 'Truck exists; caller scope',
    input: { type: 'object', required: ['truckId'], additionalProperties: false, properties: { truckId: single('Truck id.', 'string') } },
    output: ref('truck'),
  },
  {
    name: 'get_shipments_for_truck',
    purpose: 'Find cargo at risk',
    status: 'READY',
    validates: 'Truck scope',
    input: { type: 'object', required: ['truckId'], additionalProperties: false, properties: { truckId: single('Truck id.', 'string') } },
    output: refArray('shipment'),
  },
  {
    name: 'find_nearby_capacity',
    purpose: 'Find compatible spare capacity',
    status: 'READY',
    validates: 'Capacity, route, availability, status',
    input: {
      type: 'object',
      required: ['origin', 'destination', 'minAvailableT'],
      additionalProperties: false,
      properties: {
        origin: single('Route origin, matched case-insensitively.', 'string'),
        destination: single('Route destination.', 'string'),
        minAvailableT: single('Minimum spare tonnes the truck must have.', 'number'),
        excludeTruckIds: { type: 'array', items: { type: 'string' }, description: 'Trucks to ignore, e.g. the disabled one.' },
      },
    },
    output: {
      type: 'array',
      items: {
        type: 'object',
        required: ['offer', 'truck', 'route', 'pricePerT', 'currency'],
        properties: {
          offer: ref('capacityOffer'),
          truck: ref('truck'),
          route: { type: 'string' },
          driverName: nullableString,
          pricePerT: { type: 'number' },
          currency: { type: 'string' },
          distanceKm: { type: ['number', 'null'], description: 'Null when the requesting position is unknown.' },
          etaMinutes: { type: ['number', 'null'] },
        },
      },
    },
  },
  {
    name: 'get_route_options',
    purpose: 'Return route candidates',
    status: 'READY',
    validates: 'Origin/destination',
    input: {
      type: 'object',
      required: ['origin', 'destination'],
      additionalProperties: false,
      properties: {
        origin: single('Route origin.', 'string'),
        destination: single('Must differ from origin.', 'string'),
      },
    },
    output: {
      type: 'object',
      required: ['origin', 'destination', 'availableTrucks', 'totalSpareT'],
      properties: {
        origin: { type: 'string' },
        destination: { type: 'string' },
        availableTrucks: { type: 'number' },
        totalSpareT: { type: 'number' },
        cheapestPerT: { type: ['number', 'null'] },
      },
    },
  },
  {
    name: 'calculate_impact',
    purpose: 'Compare ETA/cost/operational impact',
    status: 'READY',
    validates: 'Shipment constraints',
    input: { type: 'object', required: ['incidentId'], additionalProperties: false, properties: { incidentId: single('Incident id.', 'string') } },
    output: {
      type: 'object',
      required: ['incidentId', 'truckId', 'totalWeightT'],
      properties: {
        incidentId: { type: 'string' },
        truckId: { type: 'string' },
        location: { type: 'string' },
        origin: { type: 'string' },
        destination: { type: 'string' },
        totalWeightT: { type: 'number' },
        notes: { type: 'array', items: { type: 'string' } },
        affectedShipments: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'cargoName', 'weightT'],
            properties: {
              id: { type: 'string' },
              cargoName: { type: 'string' },
              weightT: { type: 'number' },
            },
          },
        },
      },
    },
  },
  {
    name: 'create_recovery_plan',
    purpose: 'Create structured plan',
    status: 'READY',
    validates: 'Incident open; valid option',
    input: { type: 'object', required: ['incidentId'], additionalProperties: false, properties: { incidentId: single('Incident id.', 'string') } },
    output: {
      type: 'object',
      required: ['plan', 'options', 'reusedExistingPlan'],
      properties: {
        plan: ref('recoveryPlan'),
        options: refArray('recoveryOption'),
        reusedExistingPlan: {
          type: 'boolean',
          description: 'True when a plan already existed for this incident, so calling again is safe.',
        },
      },
    },
  },
  {
    name: 'request_approval',
    purpose: 'Set plan awaiting operator',
    status: 'READY',
    validates: 'Plan valid',
    input: { type: 'object', required: ['planId'], additionalProperties: false, properties: { planId: single('Recovery plan id.', 'string') } },
    output: ref('recoveryPlan'),
  },
  {
    name: 'execute_recovery',
    purpose: 'Apply approved recovery',
    status: 'READY',
    validates: 'Plan APPROVED; idempotent',
    input: {
      type: 'object',
      required: ['planId', 'executedBy'],
      additionalProperties: false,
      properties: {
        planId: single('Recovery plan id. Must be APPROVED or already COMPLETED.', 'string'),
        executedBy: single('Operator id recorded on the execution event.', 'string'),
      },
    },
    output: {
      type: 'object',
      required: ['plan', 'reassignments', 'verification', 'alreadyExecuted'],
      properties: {
        plan: ref('recoveryPlan'),
        reassignments: {
          type: 'array',
          items: {
            type: 'object',
            required: ['shipmentId', 'toTruckId', 'releasedT'],
            properties: {
              shipmentId: { type: 'string' },
              fromTruckId: nullableString,
              toTruckId: { type: 'string' },
              releasedT: { type: 'number' },
            },
          },
        },
        verification: {
          type: 'object',
          description: 'State re-read from the backend after execution, not assumed.',
          properties: {
            shipmentStatus: { type: 'string' },
            fromTruckStatus: { type: 'string' },
            toTruckStatus: { type: 'string' },
            toTruckAvailableT: { type: 'number' },
            incidentStatus: { type: 'string' },
          },
        },
        notifications: { type: 'array', items: { type: 'string' } },
        alreadyExecuted: { type: 'boolean', description: 'True when the plan was already COMPLETED; nothing moved.' },
      },
    },
  },
  {
    name: 'notify_driver',
    purpose: 'Send recovery/incident message',
    status: 'READY',
    validates: 'Recipient exists',
    input: {
      type: 'object',
      required: ['driverId', 'message'],
      additionalProperties: false,
      properties: {
        driverId: single('Driver id.', 'string'),
        message: single('Message text.', 'string'),
        incidentId: nullableString,
      },
    },
    output: {
      type: 'object',
      required: ['notification', 'delivered'],
      properties: {
        notification: ref('notification'),
        delivered: { const: false, description: 'Delivery infrastructure is a later phase; the row stays PENDING.' },
        note: { type: 'string' },
      },
    },
  },
  {
    name: 'notify_business',
    purpose: 'Send shipment update',
    status: 'READY',
    validates: 'Recipient exists',
    input: {
      type: 'object',
      required: ['organizationId', 'message'],
      additionalProperties: false,
      properties: {
        organizationId: single('Shipper organization id.', 'string'),
        message: single('Message text.', 'string'),
      },
    },
    output: {
      type: 'object',
      required: ['notification', 'delivered'],
      properties: {
        notification: ref('notification'),
        delivered: { const: false, description: 'Delivery infrastructure is a later phase; the row stays PENDING.' },
        note: { type: 'string' },
      },
    },
  },
  {
    name: 'record_event',
    purpose: 'Append immutable event',
    status: 'READY',
    validates: 'Valid event schema',
    input: {
      type: 'object',
      required: ['eventType'],
      additionalProperties: false,
      properties: {
        eventType: single('lower_snake or dot.separated, e.g. "shipment.note".', 'string'),
        shipmentId: nullableString,
        incidentId: nullableString,
        truckId: nullableString,
        payload: { type: 'object' },
        actorType: { type: 'string', enum: ['SYSTEM', 'AGENT', 'OPERATOR', 'DRIVER', 'BUSINESS'] },
        actorId: nullableString,
      },
    },
    output: ref('shipmentEvent'),
  },
  {
    name: 'create_payment_intent',
    purpose: 'Start payment flow',
    status: 'PLACEHOLDER',
    validates: 'Amount/context valid',
    input: {
      type: 'object',
      required: ['amount', 'currency'],
      additionalProperties: false,
      properties: {
        amount: single('Amount in the major unit, must be positive.', 'number'),
        currency: single('ISO 4217 code.', 'string'),
      },
    },
    unavailable: notImplemented(
      'Dodo Payments is not connected, so no intent is created and no payment state changes.',
      'Create the intent server-side, then confirm the shipment only after the backend verifies provider payment state.',
    ),
  },
  {
    name: 'anchor_proof',
    purpose: 'Hash/anchor critical event',
    status: 'PLACEHOLDER',
    validates: 'Hash exists; no fake confirmation',
    input: { type: 'object', required: ['eventId'], additionalProperties: false, properties: { eventId: single('Event id whose hash should be anchored.', 'string') } },
    unavailable: {
      type: 'object',
      description:
        'Always fails. The event hash is real, but no EVM testnet anchoring is configured, so proofStatus stays NOT_ANCHORED and no transaction hash is ever invented.',
      required: ['ok', 'error'],
      properties: {
        ok: { const: false },
        error: {
          type: 'object',
          required: ['code', 'message'],
          properties: {
            code: { const: 'NOT_IMPLEMENTED' },
            message: { type: 'string' },
            details: {
              type: 'object',
              required: ['eventId', 'hash', 'proofStatus', 'blockchainTx'],
              properties: {
                eventId: { type: 'string' },
                hash: { type: 'string' },
                proofStatus: { type: 'string', enum: ['NOT_ANCHORED', 'PENDING', 'CONFIRMED', 'FAILED'] },
                blockchainTx: { const: null, description: 'Always null. A fabricated hash is forbidden.' },
                nextStep: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
] as const;

/** The complete document served by `GET /agent/tools`. */
export const AGENT_TOOL_CONTRACT = {
  $schema: AGENT_TOOL_JSON_SCHEMA.$schema,
  $id: AGENT_TOOL_SCHEMA_ID,
  title: AGENT_TOOL_JSON_SCHEMA.title,
  description: AGENT_TOOL_JSON_SCHEMA.description,
  type: 'object',
  required: ['tools'],
  additionalProperties: false,
  properties: { tools: { type: 'array', items: ref('tool') } },
  $defs: AGENT_TOOL_JSON_SCHEMA.$defs,
  tools: AGENT_TOOL_SCHEMA_ENTRIES,
} as const;
