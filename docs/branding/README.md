# Branding Assets

This repo has multiple frontends (`admin/`, `mobile/`, `mini/`, `website/`). To keep logos and icons consistent,
put the source images here and generate derived assets for each target.

## Source Files (required)

1. `docs/branding/company_logo.png`
   - Company logo source, used for Web visible branding and as the source for transparent Web favicons.

2. `docs/branding/app_icon.png`
   - Native app icon source, used for Android/iOS launcher icons and store icon exports.

## Generate Derived Assets

Run:

```bash
./scripts/update_branding_assets.sh
```

This will:
- Generate transparent Web favicons for `admin/public/` and `website/assets/images/`.
- Output theme-aware favicon variants:
  - `favicon-light-*` = blue symbol + transparent background
  - `favicon-dark-*` = white symbol + transparent background
- Generate `favicon.ico`, `favicon.png`, and `apple-touch-icon.png`.
- Sync `website/assets/images/company-logo.png` and `website/assets/images/app-icon.png`.
- Update mobile login logo and regenerate mobile Android/iOS app icons from `app_icon.png`.

## Web Favicon Behavior

The browser tab icon does **not** use CSS. Theme switching is handled in HTML with
`prefers-color-scheme`:

- light / no-preference: load blue transparent favicon
- dark: load white transparent favicon

Entry files using this setup:
- `admin/index.html`
- `merchant/index.html`
- `website/index.html`
