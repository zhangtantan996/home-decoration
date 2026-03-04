
## Task 13 verification note

- `cd admin && npm run lint` fails due broad pre-existing lint debt in admin module.
- Targeted lint on merchant-auth changed files surfaces 3 legacy `no-explicit-any` errors in `admin/src/services/merchantApi.ts` (lines around 492/494/495), which predate this wave and were not introduced by recent responsive/auth fixes.
- `tsc --noEmit -p tsconfig.app.json` and `npm run build` both pass.
