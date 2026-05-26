# home-decoration Project Baseline

This spec is the Trellis baseline for AI coding work in `home-decoration`.

## Product Shape

`home-decoration` is a home decoration service transaction platform.

Primary surfaces:

- `mini/`: primary user transaction surface.
- `merchant/`: primary merchant fulfillment surface.
- `admin/`: primary governance surface.
- `ops/`: service-provider maintenance surface.
- `supervisor/`: project execution and supervision surface.
- `web/`: login-gated auxiliary H5 for payment result and browsing.
- `website/`: public landing and brand surface.
- `server/`: Go API, WebSocket, business workflow, persistence.
- `deploy/`: Docker, Nginx, gateway, environment wiring.
- `tests/e2e/`: Playwright coverage.

## Hard Business Boundaries

Do not change these unless the user explicitly asks:

- Full transaction flow is: design confirmation point A -> quote baseline -> construction party selection -> construction quote -> user confirms construction quote point B -> project creation.
- Design confirmation and foreman confirmation are separate transaction points.
- Project creation happens only after point B.
- Material shops are a side capability, not the main transaction loop.

High-risk domains:

- `auth`
- `identity`
- `payment/escrow`
- `deploy`
- `rbac`
- `sms`
- `legal/privacy`

High-risk domains require explicit boundary framing, targeted verification, and patch-level P0/P1 review.

## Engineering Boundaries

- Backend follows `router -> handler -> service -> repository`.
- `admin/`, `ops/`, `merchant/`, and `supervisor/` use React 18.3.1, Vite, Ant Design 5, and Zustand.
- `mobile/` uses React 19.2, React Native 0.83, and Expo.
- Do not unify React versions across apps.
- Do not introduce Redux, MobX, Recoil, or another UI framework unless the user explicitly requests it.
- Frontend visual values must come from `shared/design-tokens/tokens.json` and generated outputs.
- User-facing UI must not expose API URLs, SQL/schema/database errors, token/JWT, WebSocket internals, localhost, Docker/npm details, stack traces, or raw backend errors.

## Verification Baseline

Use the smallest meaningful verification for the touched surface:

- `server/`: targeted `go test`, then broader backend verification when needed.
- `admin/`: `npm run verify:admin`.
- `ops/`: `npm run verify:ops`.
- `merchant/`: `npm run verify:merchant`.
- `supervisor/`: `npm run verify:supervisor`.
- `web/`: `npm run verify:web`.
- `mini/`: `npm run verify:mini`.
- `mobile/`: `npm run verify:mobile`.
- schema-sensitive backend changes: `npm run db:check`.
- release or cross-surface changes: `npm run smoke:release` or a more targeted smoke path.

Every completion claim must clearly distinguish:

- verified passing
- environment blocked
- not run
- state unknown
