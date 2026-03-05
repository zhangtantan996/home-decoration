# Home Decoration Mini Program (Taro + React)

## Quick start
1. Use Node.js 20+ and install dependencies in `mini/`:
   ```bash
   npm install
   ```
2. Ensure backend API is reachable and WeChat mini program app credentials are configured.
3. Start local compile:
   ```bash
   npm run dev:weapp
   ```
4. Import the `mini/` project into WeChat DevTools.

## Environment variables
- `TARO_APP_API_BASE`: API base URL, default `http://localhost:8080/api/v1`.
- `TARO_APP_H5_URL`: H5 base URL used by the weapp WebView container. In real devices/production it should be an **HTTPS domain** and must be whitelisted in WeChat mini program settings.

Example:
```bash
TARO_APP_API_BASE=http://192.168.1.10:8080/api/v1 npm run dev:weapp
```

## Icon and quality gates
- Tab icons are generated from vector sources:
  - SVG source: `src/assets/tab/svg/*.svg`
  - Output PNG: `src/assets/tab/*.png`
- Generate tab icons manually:
  ```bash
  npm run gen:tab-icons
  ```
- Emoji gate (must pass):
  ```bash
  npm run check:no-emoji
  ```

## Development scripts
- `npm run lint`: ESLint + emoji gate
- `npm run build:weapp`: generate tab icons + compile weapp bundle
- `npm run dev:h5`: build H5 bundle (hash router) and watch on `http://localhost:5176`
- `npm run build:h5`: generate tab icons + compile h5 bundle
- `npm run format`: format source styles and TS files

## Core flow (phase 1)
- WeChat login + bind phone
- Browse providers → booking
- Proposal confirmation/rejection
- Pending payment + order/project detail
- Notifications and profile center essentials
- Inspiration list/detail + social interactions (like/favorite/comment)

## Phase 2 (not included in phase 1)
- Full IM conversation and chat room capabilities
