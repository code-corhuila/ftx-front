# ftx-front — Futbolix web frontend

Part of the **Futbolix** distributed system. Project governance and documentation live in
[`ftx-docs`](https://github.com/code-corhuila/ftx-docs).

React + Vite + TypeScript application for the Futbolix court reservation system. It implements the
screens of `ftx-docs/12-ux-ui/navigation-map.md` and consumes **only the API Gateway**
(`/api/v1`) according to the contracts in `ftx-docs/07-api/contracts/openapi/`.

```text
Browser ── web :5173 ── fetch ──► API Gateway :8080 /api/v1
                                   ├─► user-service        :8081   /auth/**
                                   ├─► court-service       :8082   /courts/**, /admin/courts/**
                                   ├─► reservation-service :8083   /availability, /reservations/**, /admin/reservations/**
                                   └─► payment-service     :8084   /payments/**
```

## Requirements

| Tool | Version |
|---|---|
| Node.js | 22 LTS (22.12 or higher) — `10-devops/local-setup.md` |
| npm | The one bundled with Node |

## Run locally

```bash
copy .env.example .env      # Windows (macOS/Linux: cp .env.example .env)
npm install
npm run dev
```

Open `http://localhost:5173`.

### Two modes

| `VITE_API_MOCK` | What it does |
|---|---|
| `true` (value in `.env.example`) | **Backend simulated in the browser.** No gateway, microservices, PostgreSQL or RabbitMQ needed. Useful for development and demos. Data is stored in `localStorage` and reset with the "Reset data" button of the yellow banner. |
| `false` | Calls the real API Gateway at `VITE_API_BASE_URL` (`http://localhost:8080` by default). The gateway must allow the origin `http://localhost:5173` in CORS (`APP_GATEWAY_CORS_ORIGIN`). |

The simulated mode (`src/api/mock/server.ts`) reproduces the contract rules the frontend must
handle: 409 `RESERVATION_SLOT_UNAVAILABLE` on overlap, `Idempotency-Key`, generic 404 for
reservation codes, court state transitions, JWT with rotating refresh, and eventual consistency
(the payment appears ~1.5 s after the reservation is created and the confirmation arrives ~1.2 s
after the Wompi result). The payment gateway is replaced by `/mock/wompi`, with buttons to approve
or reject the payment.

**Simulated-mode administrator:** the test email and password come from `VITE_MOCK_ADMIN_EMAIL`
and `VITE_MOCK_ADMIN_PASSWORD` (`.env.example` has mock-only values) and are shown at
`/admin/login` while the simulated mode is active. They only work against the simulated data and
are not embedded in the code. Without them, the simulated login rejects every credential.

## Screens and endpoints

| Route | Endpoint(s) | Service |
|---|---|---|
| `/`, `/courts`, `/courts/:courtId` | `GET /courts`, `GET /courts/{id}`, `GET /courts/{id}/schedules` | court |
| `/booking/availability` | `GET /availability?courtId=&date=` | reservation |
| `/booking/details` | `POST /reservations` + `Idempotency-Key` | reservation |
| `/booking/payment` | `POST /payments/checkouts` + `Idempotency-Key` → redirect to Wompi | payment |
| `/booking/confirmation/:code` | `GET /reservations/{code}` (polling until `CONFIRMED`/`REJECTED`) | reservation |
| `/booking/failed` | — (409 or rejected payment) | — |
| `/reservations/lookup`, `/reservations/:code` | `GET /reservations/{code}`, `POST /reservations/{code}/cancellation` | reservation |
| `/admin/login` | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` | user |
| `/admin` | `GET /admin/reservations?dateFrom=&dateTo=`, `GET /courts` | reservation, court |
| `/admin/courts`, `/admin/courts/:courtId/edit` | `PATCH /admin/courts/{id}` | court |
| `/admin/schedules` | `PUT` / `DELETE /admin/courts/{id}/schedules/{dayOfWeek}` | court |
| `/admin/reservations` | `GET /admin/reservations`, `POST /admin/reservations/{id}/cancellation` | reservation |

## Injected failure: Wompi unavailable (HU-PAY-006)

The simulated mode can reproduce a Wompi outage so the degradation can be shown in a demo:

1. Press **"Simular caída de Wompi"** in the yellow banner (or start with `VITE_MOCK_FAULTS=wompi-down`).
2. Book a slot and continue to payment. The simulated `payment-service` waits for the Wompi
   timeout (3 s) and answers **503 `SERVICE_UNAVAILABLE`**, as `payment-service.yaml` defines.
   After 3 consecutive failures the circuit opens and the next checkouts fail at once, without
   waiting (AC1).
3. The payment screen explains that the reservation is still **PENDING** and nothing was charged,
   and offers **"Reintentar pago"** (same `Idempotency-Key`) or **"Cancelar reserva"**, which frees
   the slot (compensation from the client side).
4. Availability, reservation creation and lookup keep working while the circuit is open (AC3).
5. Press **"Restablecer Wompi"**. Once the open interval (10 s) expires, the next checkout redirects
   to the payment page again (AC2).

This only simulates the circuit breaker in the browser; it does not replace the real
`payment-service` implementation. Every request also has a timeout (`VITE_API_TIMEOUT_MS`, 10 s by
default); only `GET` requests are retried.

## Structure

```text
src/
├── api/              HTTP client and one module per microservice (types = contracts from 07)
│   └── mock/         Simulated backend (only loaded with VITE_API_MOCK=true)
├── auth/             Administrator session (JWT + rotating refresh)
├── components/       Design-system components (buttons, badges, slot grid, reservation code…)
├── hooks/            useAsync, useCourts
├── lib/              COP/date formatting, domain validations, errors, booking flow state
├── pages/            One page per navigation-map route
└── styles.css        Tokens from 12-ux-ui/design-system.md
```

Decisions worth knowing:

- **Errors:** translated to Spanish (end-user text) from the stable `error` code of `ErrorResponse`,
  never from the message text (backend messages are in English).
- **Money:** always `Money { amount: integer, currency: "COP" }`. The amount the customer sees is a
  preview: it is never sent; the backend computes it.
- **Idempotency:** the key is generated once per user attempt and reused on retries; a double click
  on "Continue to payment" does not create two reservations.
- **Session:** only the administrator has a token (in `sessionStorage`, this tab only). Public
  requests never send `Authorization`.
- **Reservation code:** monospaced font, with copy and print. The latest reservations are remembered
  on this device ("Your recent reservations", mitigation from `navigation-map.md`).

## Container

For `local`/`develop` the Vite server is enough. For `qa`/`prod`, the `Dockerfile` builds the app
and serves it with nginx (proposal for open decision 2 of `10-devops/environments.md`).
`VITE_API_BASE_URL` is embedded at build time, so one image is built per environment:

```bash
docker build --build-arg VITE_API_BASE_URL=http://localhost:8180 -t ftx-front:qa .
```

Suggested entry for the system `docker-compose.yml`:

```yaml
  web:
    build:
      context: ./ftx-front
      args:
        VITE_API_BASE_URL: ${VITE_API_BASE_URL:-http://localhost:8080}
    ports:
      - "${WEB_HOST_PORT:-5173}:80"
    depends_on:
      api-gateway:
        condition: service_healthy
    networks: [futbolix-net]
```

The browser calls the gateway through the host's published port, not the internal network, so
`VITE_API_BASE_URL` uses `localhost:<gateway port>`.

## Pending items that depend on the backend or open decisions

| Topic | Status |
|---|---|
| Wompi circuit breaker | Simulated in `src/api/mock/faults.ts` (HU-PAY-006). The real one belongs to `payment-service` |
| Payment status in `/reservations/:code` | `navigation-map.md` requires it, but no contract exposes a payments `GET`. For now the reservation status is shown |
| Cancellation policy | Pending in the domain; the frontend shows the 422 `CANCELLATION_NOT_ALLOWED` if it arrives |
| Reservation code format | ADR-007 pending; validated with `^[A-Z0-9]{1,20}$` |
| Wompi webhook route | Q-002: the frontend does not call it (only the simulated gateway) |
| Generated types | Handwritten in `src/api/types.ts`. They can be generated with `openapi-typescript` from the YAML files in `ftx-docs` |

---

## Branching

Three permanent branches. **None of them accepts a direct commit** — you enter through a child
branch and leave through a Pull Request.

```
develop  <--PR--  feat/... fix/... chore/...
qa       <--PR--  qa/...
main     <--PR--  release/...  hotfix/...
```

Promotion happens **by re-application** (`git cherry-pick -x`), never by merging one permanent
branch into another: `merge develop -> qa` and `merge qa -> main` do not exist in this model.

`main` requires **1 approval from `ariel5253`**. On `develop` and `qa` the team sets its own review
rule.

Full policy: `00-governance/branching-policy.md` in [`ftx-docs`](https://github.com/code-corhuila/ftx-docs).
