# ftx-front — Frontend web de Futbolix

Parte del sistema distribuido **Futbolix**. El gobierno del proyecto y la documentación viven en
[`ftx-docs`](https://github.com/code-corhuila/ftx-docs).

Aplicación React + Vite + TypeScript del sistema de reservas de canchas Futbolix. Implementa
las pantallas de `ftx-docs/12-ux-ui/navigation-map.md` y consume **solo el API Gateway**
(`/api/v1`) según los contratos de `ftx-docs/07-api/contracts/openapi/`.

```text
Navegador ── web :5173 ── fetch ──► API Gateway :8080 /api/v1
                                     ├─► user-service        :8081   /auth/**
                                     ├─► court-service       :8082   /courts/**, /admin/courts/**
                                     ├─► reservation-service :8083   /availability, /reservations/**, /admin/reservations/**
                                     └─► payment-service     :8084   /payments/**
```

## Requisitos

| Herramienta | Versión |
|---|---|
| Node.js | 22 LTS (22.12 o superior) — `10-devops/local-setup.md` |
| npm | La que trae Node |

## Arrancar en local

```bash
copy .env.example .env      # Windows (en macOS/Linux: cp .env.example .env)
npm install
npm run dev
```

Abre `http://localhost:5173`.

### Dos modos

| `VITE_API_MOCK` | Qué hace |
|---|---|
| `true` (valor de `.env.example`) | **Backend simulado en el navegador.** No necesita gateway, microservicios, PostgreSQL ni RabbitMQ. Sirve para desarrollar y hacer demostraciones. Los datos se guardan en `localStorage` y se reinician con el botón "Reiniciar datos" del aviso amarillo. |
| `false` | Llama al API Gateway real en `VITE_API_BASE_URL` (`http://localhost:8080` por defecto). El gateway debe permitir el origen `http://localhost:5173` en CORS (`APP_GATEWAY_CORS_ORIGIN`). |

El modo simulado (`src/api/mock/server.ts`) reproduce las reglas de los contratos que el frontend
debe manejar: 409 `RESERVATION_SLOT_UNAVAILABLE` por solapamiento, `Idempotency-Key`, 404
genérico para códigos de reserva, transiciones de estado de las canchas, JWT con refresh rotativo
y consistencia eventual (el pago aparece ~1,5 s después de crear la reserva y la confirmación
llega ~1,2 s después del resultado de Wompi). La pasarela se sustituye por `/mock/wompi`, con
botones para aprobar o rechazar el pago.

**Administrador del modo simulado:** el correo y la contraseña de prueba están en
`src/api/mock/constants.ts` y se muestran en `/admin/login` mientras el modo simulado está activo.
Solo funcionan contra los datos simulados.

## Pantallas y endpoints

| Ruta | Endpoint(s) | Servicio |
|---|---|---|
| `/`, `/courts`, `/courts/:courtId` | `GET /courts`, `GET /courts/{id}`, `GET /courts/{id}/schedules` | court |
| `/booking/availability` | `GET /availability?courtId=&date=` | reservation |
| `/booking/details` | `POST /reservations` + `Idempotency-Key` | reservation |
| `/booking/payment` | `POST /payments/checkouts` + `Idempotency-Key` → redirección a Wompi | payment |
| `/booking/confirmation/:code` | `GET /reservations/{code}` (consulta periódica hasta `CONFIRMED`/`REJECTED`) | reservation |
| `/booking/failed` | — (409 o pago rechazado) | — |
| `/reservations/lookup`, `/reservations/:code` | `GET /reservations/{code}`, `POST /reservations/{code}/cancellation` | reservation |
| `/admin/login` | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` | user |
| `/admin` | `GET /admin/reservations?dateFrom=&dateTo=`, `GET /courts` | reservation, court |
| `/admin/courts`, `/admin/courts/:courtId/edit` | `PATCH /admin/courts/{id}` | court |
| `/admin/schedules` | `PUT` / `DELETE /admin/courts/{id}/schedules/{dayOfWeek}` | court |
| `/admin/reservations` | `GET /admin/reservations`, `POST /admin/reservations/{id}/cancellation` | reservation |

## Estructura

```text
src/
├── api/              Cliente HTTP y un módulo por microservicio (tipos = contratos de 07)
│   └── mock/         Backend simulado (solo se carga con VITE_API_MOCK=true)
├── auth/             Sesión del administrador (JWT + refresh rotativo)
├── components/       Componentes del design system (botones, badges, grilla de franjas, código de reserva…)
├── hooks/            useAsync, useCourts
├── lib/              Formato COP/fechas, validaciones del dominio, errores, estado del flujo de reserva
├── pages/            Una página por ruta del navigation-map
└── styles.css        Tokens de 12-ux-ui/design-system.md
```

Decisiones que vale la pena conocer:

- **Errores:** se traducen al español por el código estable `error` de `ErrorResponse`, nunca por
  el texto (los mensajes del backend están en inglés).
- **Dinero:** siempre `Money { amount: entero, currency: "COP" }`. El monto que ve el cliente es
  una vista previa: nunca se envía; el backend lo calcula.
- **Idempotencia:** la clave se genera una vez por intento del usuario y se reutiliza en los
  reintentos; un doble clic en "Continuar al pago" no crea dos reservas.
- **Sesión:** solo el administrador tiene token (en `sessionStorage`, esta pestaña). Las
  peticiones públicas nunca envían `Authorization`.
- **Código de reserva:** en fuente monoespaciada, con copiar e imprimir. Las últimas reservas se
  recuerdan en este dispositivo ("Tus reservas recientes", mitigación de `navigation-map.md`).

## Contenedor

Para `local`/`develop` basta el servidor de Vite. Para `qa`/`prod`, el `Dockerfile` construye la
app y la sirve con nginx (propuesta para la decisión abierta 2 de `10-devops/environments.md`).
`VITE_API_BASE_URL` se incrusta en el build, así que se construye una imagen por entorno:

```bash
docker build --build-arg VITE_API_BASE_URL=http://localhost:8180 -t ftx-front:qa .
```

Entrada sugerida en el `docker-compose.yml` del sistema:

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

El navegador llama al gateway por el puerto publicado del host, no por la red interna, así que
`VITE_API_BASE_URL` usa `localhost:<puerto del gateway>`.

## Pendientes que dependen del backend o de decisiones abiertas

| Tema | Situación |
|---|---|
| Estado del pago en `/reservations/:code` | `navigation-map.md` lo pide, pero ningún contrato expone un `GET` de pagos. Hoy se muestra el estado de la reserva |
| Política de cancelación | Pendiente en el dominio; el frontend muestra el 422 `CANCELLATION_NOT_ALLOWED` si llega |
| Formato del código de reserva | ADR-007 pendiente; se valida `^[A-Z0-9]{1,20}$` |
| Ruta del webhook de Wompi | Q-002: el frontend no la llama (solo la pasarela simulada) |
| Tipos generados | Escritos a mano en `src/api/types.ts`. Se pueden generar con `openapi-typescript` desde los YAML de `ftx-docs` |

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
