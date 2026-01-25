# Audio Message Playback in Admin

## Implementation Details
- Added `CustomAudioPlayer` component in `admin/src/pages/merchant/MerchantChat.tsx`.
- Uses HTML5 `<audio>` element for playback logic.
- Uses Ant Design `Button` (with icons) and `Slider` for UI.
- Updates `renderContent` to detect Drafty `EX` entities with `mime.startsWith('audio/')`.
- Updates `renderPreviewText` to show `【语音】` in conversation list.

## Usage
- Audio messages sent from mobile (m4a/AAC) are rendered as a player.
- Supports play/pause, seeking, and duration display.
