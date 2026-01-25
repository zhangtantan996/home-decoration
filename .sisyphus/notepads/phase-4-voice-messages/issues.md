## [2026-01-25T11:05:00Z] Peer dependency warning while installing Nitro audio libs

- `npm install` logged a peer dependency warning between `@rneui/base` and `react-native-safe-area-context`, but it came from existing UI kit dependencies and did not block installation; no further changes required.
