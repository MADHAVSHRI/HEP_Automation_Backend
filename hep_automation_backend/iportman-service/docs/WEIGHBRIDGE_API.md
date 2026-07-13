# Weighbridge Integration API

**Audience:** Weighbridge / Gate-Automation integration team
**Version:** 1.0
**Service:** IPORTMAN Service

This document describes the two APIs required to push weighbridge weighment data
into the Iportman gate-automation system:

1. **Operator Login** — authenticate and obtain an access token.
2. **Weighbridge Push** — submit a weighment record using that token.

---

## 1. Overview

Every weighbridge is issued a dedicated **operator account** (an 8-digit login
id and a password). The integration works in two steps:

1. Call **Login** with the login id and password to receive a **JWT access token**.
2. Send each weighment to **Weighbridge Push** with that token in the
   `Authorization` header.

The token identifies the weighbridge and is verified on every push (the operator
account must still exist and be active), so no separate API key is required for
sending data.

```
  ┌────────────┐     1. POST /operator/login          ┌─────────────────┐
  │ Weighbridge│ ───────────(loginId, password)─────▶ │  IPORTMAN API   │
  │   System   │ ◀──────────── access token ───────── │                 │
  │            │                                       │                 │
  │            │     2. POST /cargo/weighbridge        │                 │
  │            │ ──── Authorization: Bearer <token> ─▶ │                 │
  │            │ ◀────────── 201 Created ───────────── │                 │
  └────────────┘                                       └─────────────────┘
```

### Base URL

```
https://<host>:<port>/api
```

> Replace `<host>:<port>` with the environment provided to you (default port `5008`).
> All paths below are relative to this base URL.

### Conventions

- All request and response bodies are **JSON**; send `Content-Type: application/json`.
- All responses include a boolean `success` field.
- Error responses have the shape `{ "success": false, "message": "<reason>" }`.
- Timestamps in responses are ISO-8601 UTC.

---

## 2. Operator Login

Authenticates a weighbridge operator and returns a JWT access token.

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/operator/login` |
| **Auth** | None (public) |

### Request headers

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |

### Request body

| Field | Type | Required | Description |
|---|---|---|---|
| `loginId` | string | Yes | The 8-digit login id issued to the weighbridge. |
| `password` | string | Yes | The operator password. |

### Example request

```bash
curl -X POST "https://<host>:<port>/api/operator/login" \
  -H "Content-Type: application/json" \
  -d '{
    "loginId": "71813779",
    "password": "Secret@123"
  }'
```

### Success response — `200 OK`

```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "data": {
    "id": 2,
    "loginId": "71813779",
    "weighBridgeName": "APAC WB-2"
  }
}
```

- `token` — the JWT access token. Use it in the `Authorization` header of the
  Weighbridge Push API.
- The token is valid for **24 hours**. After it expires, call Login again.

### Error responses

| Status | `message` | Meaning |
|---|---|---|
| `400` | `loginId and password are required` | A field is missing. |
| `401` | `Invalid login id or password` | Unknown login id or wrong password. |
| `403` | `Account is inactive` | The operator account is disabled. |
| `500` | `Internal server error` | Unexpected server error. |

---

## 3. Weighbridge Push

Submits a single weighment record. Each record is uniquely identified by its
`serialNo`.

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/cargo/weighbridge` |
| **Auth** | Bearer token (from Login) |

### Request headers

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `Authorization` | `Bearer <token>` |

### Request body

All fields are **required**.

| Field | Type | Allowed values / format | Description |
|---|---|---|---|
| `weighBridgeName` | string | — | Name of the weighbridge. |
| `serialNo` | string | unique | Serial number of the weighment. Must be unique. |
| `weighDate` | string | `YYYY-MM-DD` | Date of weighment. |
| `weighTime` | string | `HH:MM:SS` | Time of weighment. |
| `vehicleNumber` | string | — | Vehicle registration number. |
| `movementType` | string | `export`, `import` | Direction of movement. |
| `cargo` | string | — | Cargo description. |
| `clientName` | string | — | Client / party name. |
| `grossWeight` | number | — | Gross weight. |
| `tareWeight` | number | — | Tare weight. |
| `netWeight` | number | — | Net weight. |
| `weightUnit` | string | `kg`, `ton`, `lb`, `g` | Unit for all three weights. |

### Example request

```bash
curl -X POST "https://<host>:<port>/api/cargo/weighbridge" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "weighBridgeName": "APAC Weighbridge-1",
    "serialNo": "SN-1001",
    "weighDate": "2026-07-09",
    "weighTime": "10:30:00",
    "vehicleNumber": "TN01AB1234",
    "movementType": "export",
    "cargo": "Iron Ore",
    "clientName": "ABC Exports Pvt Ltd",
    "grossWeight": 32500.50,
    "tareWeight": 12500.25,
    "netWeight": 20000.25,
    "weightUnit": "kg"
  }'
```

### Success response — `201 Created`

```json
{
  "success": true,
  "message": "Weighbridge record saved successfully",
  "data": {
    "id": 14,
    "weighBridgeName": "APAC Weighbridge-1",
    "serialNo": "SN-1001",
    "weighDate": "2026-07-09",
    "weighTime": "10:30:00",
    "vehicleNumber": "TN01AB1234",
    "movementType": "export",
    "cargo": "Iron Ore",
    "clientName": "ABC Exports Pvt Ltd",
    "grossWeight": "32500.5",
    "tareWeight": "12500.25",
    "netWeight": "20000.25",
    "weightUnit": "kg",
    "createdAt": "2026-07-09T10:31:00.000Z",
    "updatedAt": "2026-07-09T10:31:00.000Z"
  }
}
```

> **Note:** Weight values are returned as strings (e.g. `"32500.5"`) to preserve
> decimal precision.

### Error responses

| Status | Example `message` | Meaning |
|---|---|---|
| `400` | `Missing required fields: cargo, netWeight` | One or more required fields are missing/empty. |
| `400` | `Invalid movementType. Allowed values: export, import` | `movementType` is not an allowed value. |
| `400` | `Invalid weightUnit. Allowed values: kg, ton, lb, g` | `weightUnit` is not an allowed value. |
| `401` | `Unauthorized: missing bearer token` | No `Authorization` header. |
| `401` | `Unauthorized: invalid or expired token` | Token is malformed or expired — log in again. |
| `401` | `Unauthorized: operator no longer exists` | The operator account was removed. |
| `403` | `Account is inactive` | The operator account is disabled. |
| `409` | `Weighbridge record with serial number 'SN-1001' already exists` | A record with this `serialNo` already exists. |
| `500` | `Internal server error` | Unexpected server error. |

### Duplicate handling

`serialNo` is unique. Re-sending a record with an existing `serialNo` returns
`409 Conflict` and does **not** create a duplicate. Use a new `serialNo` for each
weighment.

---

## 4. Quick reference

| API | Method | Path | Auth |
|---|---|---|---|
| Login | `POST` | `/operator/login` | None |
| Weighbridge Push | `POST` | `/cargo/weighbridge` | Bearer token |

**Enums**

- `movementType`: `export`, `import`
- `weightUnit`: `kg`, `ton`, `lb`, `g`

**Token lifetime:** 24 hours. Re-authenticate when a request returns
`401 invalid or expired token`.

---

## 5. Typical integration sequence

1. On startup (or when the token is missing/expired), call **Login** and cache
   the returned `token`.
2. For each completed weighment, call **Weighbridge Push** with a unique
   `serialNo` and the cached token.
3. If a push returns `401 invalid or expired token`, call **Login** again to get
   a fresh token, then retry the push.
4. A `409` response means that weighment was already submitted — it can be
   safely treated as success (idempotent).
