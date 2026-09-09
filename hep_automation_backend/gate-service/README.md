# gate-service

Real-time gate verification. Gate hardware (QR reader, face terminal, ANPR
camera, container OCR) posts an event; this service resolves the identifier
against the existing master data and pushes a normalised result to exactly the
CISF officers posted to that gate.

```
hardware ──POST /api/gate-verification/event──┐
                                              ├─► processEvent() ─► enrich ─► persist ─► socket room "gate:GATE_01"
console  ──POST /api/gate-verification/test-event──┘                                          │
                                                                                              ▼
                                                                        Flutter console of officers on GATE_01 only
```

Both entry points run the *same* pipeline; only the recorded `source`
(`HARDWARE` / `SIMULATION`) differs.

## Setup

```bash
cd gate-service
npm install
cp .env.example .env         # JWT_SECRET and SERVICE_AUTH_KEY must match auth-service
npx sequelize-cli db:migrate
npx sequelize-cli db:seed --seed 20260813120300-seed-gates.js
npm run dev                  # port 5012
```

`start-services.sh` starts it alongside the other services.

### Assign an officer to a gate

Postings are operational data, so they are not seeded. `userId` is the existing
`users.id` of the CISF officer — no separate officer table exists.

```sql
INSERT INTO gate_officer_assignments ("gateId","userId","isActive","createdAt","updatedAt")
VALUES ((SELECT id FROM gates WHERE "gateCode"='GATE_01'),
        (SELECT id FROM users  WHERE "userName"='cisf'),
        true, NOW(), NOW());
```

## Endpoints

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/gate-verification/event` | `x-service-key` | Production hardware event |
| POST | `/api/gate-verification/test-event` | Bearer token | Simulated event (same pipeline) |
| GET | `/api/gate-verification/my-gates` | Bearer token | Gates the caller is posted to |
| GET | `/api/gate-verification/gates/:gateCode/events?limit=20` | Bearer token | Recent events for one gate |
| GET | `/health` | — | Liveness |

## Test API examples

All five verification types. Replace `$TOKEN` with a CISF officer's access
token from `POST /api/auth/login`.

```bash
# FACE — identifier is a master_persons id or card number
curl -X POST http://localhost:5012/api/gate-verification/test-event \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"gateId":"GATE_01","verificationType":"FACE","identifier":"1","verified":true,"matchScore":95,"deviceId":"FACE-CAM-02"}'

# QR — identifier is the card number encoded in the pass
curl -X POST http://localhost:5012/api/gate-verification/test-event \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"gateId":"GATE_01","verificationType":"QR","identifier":"CPA-PASS-88214","verified":true,"deviceId":"QR-01"}'

# VEHICLE — identifier is the plate the ANPR read
curl -X POST http://localhost:5012/api/gate-verification/test-event \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"gateId":"GATE_01","verificationType":"VEHICLE","identifier":"UP91AT4254","verified":true,"deviceId":"ANPR-CAM-02"}'

# CONTAINER
curl -X POST http://localhost:5012/api/gate-verification/test-event \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"gateId":"GATE_01","verificationType":"CONTAINER","identifier":"BMOU6708365","verified":true,"deviceId":"CARGO-CAM-05"}'

# CARGO
curl -X POST http://localhost:5012/api/gate-verification/test-event \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"gateId":"GATE_01","verificationType":"CARGO","identifier":"BMOU6708365","verified":true,"deviceId":"RAPISCAN-01"}'

# Failure case — the console shows ACCESS DENIED with this reason
curl -X POST http://localhost:5012/api/gate-verification/test-event \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"gateId":"GATE_01","verificationType":"VEHICLE","identifier":"TN22AB1234","verified":false,"reason":"VEHICLE NUMBER MISMATCH"}'
```

Production route (what the hardware will call):

```bash
curl -X POST http://localhost:5012/api/gate-verification/event \
  -H "Content-Type: application/json" -H "x-service-key: $SERVICE_AUTH_KEY" \
  -d '{"gateId":"GATE_01","type":"VEHICLE","plateNumber":"UP91AT4254","success":true,"confidence":0.97,"device":"ANPR-CAM-02","timestamp":"2026-08-13T10:42:31Z"}'
```

### Vendor payload tolerance

The hardware is not available yet, so the reader accepts common aliases and
normalises them — an integration can send its own spelling without a mobile
release:

| Canonical | Also accepted |
|---|---|
| `gateId` | `gateCode`, `gate` |
| `verificationType` | `type` |
| `identifier` | `value`, `plateNumber`, `containerNumber`, `cardNumber`, `employeeId` |
| `verified` | `success` |
| `matchScore` (0-100) | `confidence`, `score` (0-1 is rescaled) |
| `deviceId` | `device` |
| `eventTimestamp` | `timestamp`, `occurredAt` |

## Real-time contract

Namespace `/gate-verification`, handshake `auth: { token }` (the officer's
existing access token).

Server → client:

| Event | Payload |
|---|---|
| `gates:assigned` | `{ gates: [{ id, gateCode, gateName, laneName, location }] }` |
| `verification:event` | normalised event (below) |
| `gate:error` | `{ message }` |

```json
{
  "eventId": "0e6f…",
  "gate": { "gateCode": "GATE_01", "gateName": "Gate 0", "laneName": "Entry Lane A" },
  "verificationType": "FACE",
  "identifier": "1",
  "status": "PASSED",
  "verified": true,
  "matchScore": 95,
  "reason": null,
  "deviceId": "FACE-CAM-02",
  "subject": { "type": "PERSON", "name": "…", "passId": "…", "designation": "…" },
  "occurredAt": "2026-08-13T10:42:31.000Z",
  "receivedAt": "2026-08-13T10:42:31.114Z",
  "source": "SIMULATION"
}
```

`subject` is type-specific (`PERSON` / `VEHICLE` / `CONTAINER`) and is `null`
when the identifier matched nothing — in that case `status` is never `PASSED`.

## Security

- **Gate authorization is server-side only.** The socket never accepts a gate
  from the client; after verifying the token it reads
  `gate_officer_assignments` and joins those rooms itself. Editing a `gateId`
  in the app achieves nothing.
- **No second login.** The same `JWT_SECRET` as auth-service; role and
  department are read from the signed token, matching auth-service's rule that
  those values are never taken from a response body.
- **Non-CISF tokens are refused** at the handshake, as are officers with no
  active posting.
- **`test-event` is gate-scoped**: an officer can only simulate on gates they
  hold, so it cannot be used to inject into another officer's console.
- **Hardware route is machine-authenticated** with the shared
  `SERVICE_AUTH_KEY` (`x-service-key`), the same convention as qr-service.
- **The device does not decide the outcome.** An identifier that resolves to
  nothing is `FAILED` even if the device reported `verified: true`; a lookup
  outage degrades to `PENDING` (manual check) rather than silently passing.

## Adding a verification type

1. Add the type to `src/constants/constants.js`.
2. Add a handler in `src/services/verificationTypes.js` returning the subject
   fields to display.

Nothing else changes — the controller, pipeline, socket layer and the Flutter
client are all type-agnostic.
