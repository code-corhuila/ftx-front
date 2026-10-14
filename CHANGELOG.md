# Changelog

All notable changes to `ftx-front` are recorded in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow
the course releases, one per MVP (`ftx-docs/00-governance/branching-policy.md`).

## [Unreleased]

Open pull requests to `develop`, not merged:

- Cancha 4 starts as ACTIVE in the mock data (#6).
- Test setup with Vitest, Testing Library and jsdom, and `npm test` (#7).
- Reservations that start before the current time in America/Bogota are rejected, in the form and
  in the mock (#8).
- Tests for the API clients and `ErrorResponse` handling (#9) and for the reservation code, the
  409 slot conflict, the 404 lookup and the administrator route guard (#10).
- Simulated administrator credentials read from `VITE_MOCK_ADMIN_*` instead of the code (#13).
- HU-PAY-006 in the mock: injectable Wompi outage with a circuit breaker, degraded payment screen
  with retry and cancel, and a request timeout (#14).
- Error boundary: a rendering error shows a retry message instead of a blank screen (#15).

## [2.0.0] - Unreleased

Content of branch `release/2.0.0` (pull request #5 to `main`, open). No `v2.0.0` tag exists in
this repository. `package.json` still says `0.1.0`.

### Added

- React 19 + Vite 6 + TypeScript frontend for customers and the administrator: courts, availability,
  booking with `Idempotency-Key`, payment redirect to Wompi, confirmation with polling, reservation
  lookup and cancellation, administrator login with rotating refresh token, reservations, courts
  and schedules (#1, 2026-10-05).
- Browser-side mock of the API Gateway (`VITE_API_MOCK=true`) that follows the OpenAPI contracts of
  `ftx-docs/07-api`, including 409 on overlapping slots and eventual consistency of the payment
  result (#1).
- `Dockerfile` and `nginx.conf` to serve the build for `qa` and `prod`, with `VITE_API_BASE_URL`
  set at build time (#1).

### Changed

- README, `Dockerfile` and `.env.example` translated to English (#2, 2026-10-13).

### Not included in this release

- Integration with real services: no microservice of Futbolix exists in code yet, so the app has
  only been run against the mock.
- Automated tests: they are in the open pull requests listed under "Unreleased".
