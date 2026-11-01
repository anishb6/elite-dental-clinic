# HTTP API Reference

All API routes live under `src/routes/api/` and return a standard JSON envelope (`src/api/types.ts`):

```jsonc
// Success (200 OK)
{ "ok": true, "data": { ... } }

// Failure (4xx / 5xx)
{ "ok": false, "error": { "code": "VALIDATION" | "RATE_LIMIT" | "UPSTREAM" | "CONFIG" | "SERVER", "message": "User-safe error message" } }
```

Technical stack traces and sensitive error causes are logged on the server and are never exposed in JSON responses.

---

## 1. Booking Endpoints (Public)

### `POST /api/create-appointment`

Single trusted server-side write path for creating appointment requests. Validates inputs, normalizes phone numbers to E.164, enforces clinic timezone calendar validation (`Asia/Kolkata`), checks honeypot and replay guards, writes to Supabase using `service_role`, and queues durable email notification.

**Request Headers**:

- `Content-Type: application/json`

**Request Body**:

```jsonc
{
  "name": "Asha Roy", // Required, 1-100 characters
  "phone": "91477 18046", // Required, Indian phone or valid international
  "email": "asha@example.com", // Optional, valid email up to 255 chars
  "preferred_date": "2026-11-05", // Required, YYYY-MM-DD, today or future in Asia/Kolkata
  "preferred_time": "Evening", // Required, "Morning" | "Afternoon" | "Evening"
  "message": "Routine checkup", // Optional, up to 1000 characters
  "source": "Google search", // Optional, one of BOOKING_SOURCES
  "website": "", // Honeypot field: real visitors leave blank
  "turnstile_token": "", // Optional Cloudflare Turnstile token
  "privacy_consent": true, // Required, must be true. The server stamps the time and policy version itself
}
```

**Responses**:

- `200 OK`: `{ "ok": true, "data": { "id": "uuid", "saved": true } }`
- `400 Bad Request`: Validation error or bot detection failure (`VALIDATION`)
- `429 Too Many Requests`: Rate limit exceeded (`RATE_LIMIT`)
- `500 Server Error`: Server configuration missing (`CONFIG`) or database failure (`SERVER`)

---

## 2. Staff Admin Endpoints (Protected by Supabase Auth)

All admin endpoints require an `Authorization: Bearer <session-token>` header obtained by logging in via `/admin/login`.
Successful admin responses carry `Cache-Control: no-store` because they contain patient data.

### `GET /api/admin/appointments`

Returns a paginated list of appointments with notification outbox status. The `search` parameter matches the name, or the phone (a term with 6+ digits is matched on its digits only, so "91477 18046" finds `+919147718046`).

**Query Parameters**:

- `page`: Page number (default: 1)
- `pageSize`: Records per page (default: 15, max: 50)
- `status`: Optional filter (`all`, `new`, `called`, `confirmed`, `visited`, `completed`, `cancelled`, `no_show`)
- `search`: Search query string matching patient name or phone number

**Responses**:

- `200 OK`:
  ```json
  {
    "ok": true,
    "data": {
      "appointments": [
        {
          "id": "uuid",
          "name": "Asha Roy",
          "phone": "+919147718046",
          "email": "asha@example.com",
          "preferred_date": "2026-11-05",
          "preferred_time": "Evening",
          "message": "Tooth cleaning",
          "status": "new",
          "created_at": "2026-10-27T01:30:00Z",
          "notification": {
            "status": "sent",
            "attempts": 1,
            "last_error": null
          }
        }
      ],
      "totalCount": 24,
      "page": 1,
      "pageSize": 15,
      "totalPages": 2
    }
  }
  ```
- `401 Unauthorized`: Missing or invalid Bearer token

### `PATCH /api/admin/appointments`

Updates the operational status of an appointment.

**Request Body**:

```jsonc
{
  "id": "uuid",
  "status": "confirmed", // "new" | "called" | "confirmed" | "visited" | "completed" | "no_show" | "cancelled"
}
```

**Responses**:

- `200 OK`: `{ "ok": true, "data": { "id": "uuid", "status": "confirmed", "updated": true } }`
- `400 Bad Request`: Invalid status value
- `401 Unauthorized`: Missing or invalid Bearer token
- `404 Not Found`: No appointment with that id

### `POST /api/admin/retry-outbox`

Triggers immediate processing of all pending or failed notification jobs in `notification_outbox`.

**Responses**:

- `200 OK`: `{ "ok": true, "data": { "processed": 3, "succeeded": 3, "failed": 0 } }`
- `401 Unauthorized`: Missing or invalid Bearer token

---

## 3. Scheduled Worker & Cron Endpoints (Secret-Protected)

### `POST /api/retry-notifications`

Automated scheduled trigger endpoint for Cloudflare Cron Triggers or background workers to drain pending outbox retries.

**Request Headers**:

- `X-Notify-Secret: <NOTIFY_SECRET>`

**Responses**:

- `200 OK`: `{ "ok": true, "data": { "processed": 2, "succeeded": 2, "failed": 0 } }`
- `401 Unauthorized`: Missing or invalid secret
- `500 Server Error`: `NOTIFY_SECRET` is not set on the server

---

## Conventions for new endpoints

- Register browser-called paths in `src/api/endpoints.ts`; never hard-code `/api/...` in feature code.
- Handlers throw `AppError` and return `jsonOk(...)`; `withApiHandler` produces the envelope above.
- Internal (cron/worker) endpoints authenticate with `requireNotifySecret(request)`
  (`X-Notify-Secret`, constant-time compare, fails closed when `NOTIFY_SECRET` is unset).
- Full checklist: "Adding an endpoint" in [ARCHITECTURE.md](ARCHITECTURE.md).
