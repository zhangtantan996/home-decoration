# Design Tokens

This directory contains the shared design tokens for the home-decoration project. These tokens serve as the single source of truth for UI constants across different platforms, currently focusing on the mobile application.

## Source of Truth
- `tokens.json`: The primary definition file for colors, spacing, radii, and typography.

## Generation
Tokens are transformed into platform-specific formats using generation scripts.

- **Command**: `npm run gen:tokens`
- **Script**: `shared/design-tokens/scripts/generate-rn.js`

## Outputs
Running the generation command updates the following files in the mobile project:
- `mobile/src/theme/tokens.ts`: Standard TypeScript tokens for styling.
- `mobile/src/theme/tokens.raw.ts`: Raw string values (primarily for animations).

## Usage Example
```typescript
import { colors, spacing } from '../theme/tokens';

const style = {
  backgroundColor: colors.brand,
  padding: spacing.md,
};
```

## Rules
- **Do not edit generated files manually.** Any changes made directly to `mobile/src/theme/tokens.ts` or `mobile/src/theme/tokens.raw.ts` will be overwritten.
- Always modify `tokens.json` first, then run the generation script to propagate changes.
