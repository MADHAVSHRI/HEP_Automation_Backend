# TOS Integration API

**Audience:** Terminal Operating System integration team  
**Version:** 1.0  
**Service:** TOS Service

This document describes TOS login and real-time push APIs used by APACS.

## Base URL

```text
http://<host>:<port>/api
```

Default port is `5009`.

## 1. Login

| | |
|---|---|
| Method | POST |
| Path | /tos/login |
| Auth | None |

### Request

```json
{
  "loginId": "CCTL001",
  "password": "tos_password"
}
```

### Success

```json
{
  "success": true,
  "message": "Login successful",
  "token": "<jwt>",
  "data": {
    "loginId": "CCTL001",
    "terminal": "CCTL"
  }
}
```

## 2. Form13 Push

| | |
|---|---|
| Method | POST |
| Path | /tos/form13/push |
| Auth | Bearer token |

### Rules

- `form13No`, `terminal`, `trailerNumber` required
- `terminal`: `CCTL` or `CITPL`
- max 4 containers
- max 2 `Export` and max 2 `Import`
- for `Export`: `containerNumber`, `containerISO`, `containerSize` are mandatory

### Success

```json
{
  "success": true,
  "message": "Form-13 record saved successfully"
}
```

## 3. EIR Push

| | |
|---|---|
| Method | POST |
| Path | /tos/eir/push |
| Auth | Bearer token |

### Rules

- all fields required
- `terminal`: `CCTL`, `CITPL`
- `movementType`: `Export`, `Import`
- `fullEmpty`: `Full`, `Empty`
- `oocStatus`: `Yes`, `No`
- `markedForScanning`: `Yes`, `No`

### Success

```json
{
  "success": true,
  "message": "EIR record saved successfully"
}
```
