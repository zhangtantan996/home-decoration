# Branding Assets

This repo has multiple frontends (admin/mobile/mini/website). To keep logos/icons consistent,
put the source images here and generate derived assets for each target.

## Source Files (required)

1. `docs/branding/company_logo.png`
   - Company logo (pure blue), used for in-app/logo displays (e.g. mobile login page, website nav).

2. `docs/branding/app_icon.png`
   - App icon (blue/white variant), used for app icons and favicons.

## Generate Derived Assets

Run:

```bash
./scripts/update_branding_assets.sh
```

This will:
- Update admin favicon.
- Update mobile login logo (company logo).
- Regenerate mobile Android/iOS app icons from `app_icon.png`.
- Update website (static dist) logo assets and references.

