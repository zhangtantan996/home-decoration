# Design Tokens

`shared/design-tokens/tokens.json` is the single source of truth for visual constants across all frontend surfaces.

## Generate

```bash
npm run gen:tokens
```

Scoped generation is also supported:

```bash
node shared/design-tokens/scripts/generate-platforms.mjs --scope web
node shared/design-tokens/scripts/generate-platforms.mjs --scope website
node shared/design-tokens/scripts/generate-platforms.mjs --scope mini
node shared/design-tokens/scripts/generate-platforms.mjs --scope mobile
node shared/design-tokens/scripts/generate-platforms.mjs --scope admin
node shared/design-tokens/scripts/generate-platforms.mjs --scope merchant
```

## Outputs

- `admin/src/styles/theme.ts`
- `merchant/src/styles/theme.ts`
- `merchant/src/constants/merchantTheme.ts`
- `web/src/app/tokens.css`
- `website/styles/tokens.css`
- `mini/src/theme/tokens.ts`
- `mini/src/theme/tokens.scss`
- `mobile/src/theme/tokens.ts`
- `mobile/src/theme/tokens.raw.ts`

Do not edit generated files directly. Change `tokens.json`, regenerate, then run the scoped frontend style guard.

## Usage

Web and website:

```css
.panel {
  color: var(--color-primary);
  border-radius: var(--radius-md);
}
```

Mini:

```scss
@import "../../theme/tokens";

.panel {
  color: $color-primary;
  padding: $spacing-md;
}
```

Mobile:

```typescript
import { colors, spacing } from '../theme/tokens';

const style = {
  backgroundColor: colors.bgCard,
  padding: spacing.md,
};
```
