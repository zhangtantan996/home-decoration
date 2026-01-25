## [2026-01-25T11:00:00Z] Voice message native prep

- Installed `react-native-nitro-sound` and `react-native-nitro-modules` so the mobile client can record/playback voice messages once platform permissions are in place.
- Added `RECORD_AUDIO` to the Android manifest and tuned the iOS `NSMicrophoneUsageDescription` copy to reflect voice messaging instead of video capture.
- Confirmed the mobile TypeScript build (`npx tsc -p mobile/tsconfig.json --noEmit`) stays clean after the native module additions.
