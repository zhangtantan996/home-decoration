# Global UI/UX Standards: Modals & Popups
**Version 1.0**

> **Core Principle**: **NEVER use native `Alert.alert` or system dialogs.**
> All feedback, confirmations, and alerts must use the custom, premium-styled `InfoModal` or functionally equivalent custom components.

## 1. Design Philosophy
- **Premium Feel**: All popups must match the app's design system (rounded corners, subtle shadows, consistent typography).
- **Immersive**: Modals must be presented properly over all content, including:
  -   Covering the Status Bar (translucent/dimmed background).
  -   Covering the Bottom Tab Bar / Navigation.
  -   Using the native `<Modal>` component to ensure highest z-index.
- **Micro-interactions**: Must include smooth entry (scale/fade-in) and exit (fade-out) animations.

## 2. Component Implementation (`InfoModal`)

### Standard Usage
Use the `InfoModal` component for generic feedback.

```tsx
// ❌ BAD (Forbidden)
Alert.alert('Success', 'Project created!');

// ✅ GOOD (Required)
<InfoModal
    visible={visible}
    type="success" // 'success' | 'error' | 'info'
    title="创建成功"
    message="您的项目已成功立项"
    buttonText="前往详情"
    onClose={handleClose}
/>
```

### Technical Requirements
- **Container**: Must use React Native's `<Modal transparent statusBarTranslucent>` to break out of parent layouts and handle safe areas correctly.
- **Overlay**: Full screen `rgba(0,0,0,0.5)` backdrop.
- **Animations**:
  -   **Entry**: 250ms Spring/Timing (Scale 0.9 -> 1.0, Opacity 0 -> 1).
  -   **Exit**: 200ms Timing (Opacity 1 -> 0).
- **Typography**:
  -   **Title**: 18px, Bold (600/700), Color `#18181B`.
  -   **Body**: 15px, Regular/Medium, Color `#71717A`, Center aligned.
  -   **Button**: Primary branding color (e.g., `#09090B` or `#16A34A` for success), 16px Text white.

## 3. Interaction Patterns
1.  **Success**: Green Icon (`#10B981`) + Light Green bg. Auto-dismiss or single generic comparison button.
2.  **Error**: Red Icon (`#EF4444`) + Light Red bg. "Retry" or "Close" button.
3.  **Confirmation**: Double button (Cancel/Confirm). Use a specialized `ConfirmModal` if `InfoModal` is insufficient.

## 4. Updates & Maintenance
- When adding new features, **always** reuse `src/components/InfoModal.tsx` or `src/components/CancelOrderModal.tsx`.
- Do not create one-off modal styles inline.
