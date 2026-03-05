#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

COMPANY_SRC="${ROOT}/docs/branding/company_logo.png"
APPICON_SRC="${ROOT}/docs/branding/app_icon.png"

if [[ ! -f "${COMPANY_SRC}" ]]; then
  echo "Missing ${COMPANY_SRC}"
  echo "Please add the company logo PNG (pure blue) at that path."
  exit 2
fi

if [[ ! -f "${APPICON_SRC}" ]]; then
  echo "Missing ${APPICON_SRC}"
  echo "Please add the app icon PNG (blue/white) at that path."
  exit 2
fi

if ! command -v sips >/dev/null 2>&1; then
  echo "Missing required tool: sips (macOS)"
  exit 2
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "Missing required tool: python3"
  exit 2
fi

resize_to_png() {
  local src="$1"
  local size="$2"
  local out="$3"
  # Force output format so we don't end up with a JPEG file named .png.
  sips -s format png -z "${size}" "${size}" "${src}" --out "${out}" >/dev/null
}

to_png() {
  local src="$1"
  local out="$2"
  sips -s format png "${src}" --out "${out}" >/dev/null
}

echo "[1/5] admin favicon"
ADMIN_PUBLIC="${ROOT}/admin/public"
mkdir -p "${ADMIN_PUBLIC}"
resize_to_png "${APPICON_SRC}" 64 "${ADMIN_PUBLIC}/favicon.png"

# Ensure both entry HTML files reference the favicon.
for html in "${ROOT}/admin/index.html" "${ROOT}/admin/merchant.html"; do
  if [[ -f "${html}" ]]; then
    python3 - "${html}" <<'PY'
import re
import sys

path = sys.argv[1]
with open(path, "r", encoding="utf-8") as f:
    s = f.read()

# Replace the default Vite favicon.
s2 = re.sub(
    r'<link\s+rel="icon"[^>]*href="/vite\.svg"[^>]*>',
    '<link rel="icon" type="image/png" href="/favicon.png" />',
    s,
    count=1,
)

if s2 != s:
    with open(path, "w", encoding="utf-8") as f:
        f.write(s2)
    print(path)
PY
  fi
done

echo "[2/5] mobile in-app logo (login top logo uses this file)"
MOBILE_LOGO="${ROOT}/mobile/src/assets/logo.png"
mkdir -p "$(dirname "${MOBILE_LOGO}")"
to_png "${COMPANY_SRC}" "${MOBILE_LOGO}"

echo "[3/5] mobile Android launcher icons"
declare -a ANDROID_SIZES=(
  "mipmap-mdpi 48"
  "mipmap-hdpi 72"
  "mipmap-xhdpi 96"
  "mipmap-xxhdpi 144"
  "mipmap-xxxhdpi 192"
)

for entry in "${ANDROID_SIZES[@]}"; do
  dir="$(awk '{print $1}' <<<"${entry}")"
  size="$(awk '{print $2}' <<<"${entry}")"
  out_dir="${ROOT}/mobile/android/app/src/main/res/${dir}"
  mkdir -p "${out_dir}"
  resize_to_png "${APPICON_SRC}" "${size}" "${out_dir}/ic_launcher.png"
  resize_to_png "${APPICON_SRC}" "${size}" "${out_dir}/ic_launcher_round.png"
done

echo "[4/5] mobile iOS AppIcon asset catalog"
IOS_APPICON_DIR="${ROOT}/mobile/ios/HomeDecorationApp/Images.xcassets/AppIcon.appiconset"
mkdir -p "${IOS_APPICON_DIR}"

cat > "${IOS_APPICON_DIR}/Contents.json" <<'JSON'
{
  "images": [
    { "idiom": "iphone", "size": "20x20", "scale": "2x", "filename": "AppIcon-20@2x.png" },
    { "idiom": "iphone", "size": "20x20", "scale": "3x", "filename": "AppIcon-20@3x.png" },
    { "idiom": "iphone", "size": "29x29", "scale": "2x", "filename": "AppIcon-29@2x.png" },
    { "idiom": "iphone", "size": "29x29", "scale": "3x", "filename": "AppIcon-29@3x.png" },
    { "idiom": "iphone", "size": "40x40", "scale": "2x", "filename": "AppIcon-40@2x.png" },
    { "idiom": "iphone", "size": "40x40", "scale": "3x", "filename": "AppIcon-40@3x.png" },
    { "idiom": "iphone", "size": "60x60", "scale": "2x", "filename": "AppIcon-60@2x.png" },
    { "idiom": "iphone", "size": "60x60", "scale": "3x", "filename": "AppIcon-60@3x.png" },
    { "idiom": "ios-marketing", "size": "1024x1024", "scale": "1x", "filename": "AppIcon-1024.png" }
  ],
  "info": { "author": "xcode", "version": 1 }
}
JSON

# Generate images from source
declare -a IOS_PX=(
  "40 AppIcon-20@2x.png"
  "60 AppIcon-20@3x.png"
  "58 AppIcon-29@2x.png"
  "87 AppIcon-29@3x.png"
  "80 AppIcon-40@2x.png"
  "120 AppIcon-40@3x.png"
  "120 AppIcon-60@2x.png"
  "180 AppIcon-60@3x.png"
  "1024 AppIcon-1024.png"
)
for entry in "${IOS_PX[@]}"; do
  px="$(awk '{print $1}' <<<"${entry}")"
  fn="$(awk '{print $2}' <<<"${entry}")"
  resize_to_png "${APPICON_SRC}" "${px}" "${IOS_APPICON_DIR}/${fn}"
done

echo "[5/5] website static dist assets"
WEBSITE_DIST="${ROOT}/website/dist"
if [[ -d "${WEBSITE_DIST}" ]]; then
  mkdir -p "${WEBSITE_DIST}/assets"
  resize_to_png "${COMPANY_SRC}" 256 "${WEBSITE_DIST}/assets/company-logo.png"
  resize_to_png "${APPICON_SRC}" 256 "${WEBSITE_DIST}/assets/app-icon.png"

  # Update HTML references (keep it simple: company logo for nav, app icon for app preview)
  if [[ -f "${WEBSITE_DIST}/index.html" ]]; then
    python3 - "${WEBSITE_DIST}/index.html" <<'PY'
import re
import sys

path = sys.argv[1]
with open(path, "r", encoding="utf-8") as f:
    s = f.read()

# Replace app preview logo first
s = re.sub(r'(<img\s+class="app-logo-img"\s+src=")/assets/[^"]+(")', r'\1/assets/app-icon.png\2', s)
# Replace nav/brand logos
s = re.sub(r'(<img\s+class="logo-img"\s+src=")/assets/[^"]+(")', r'\1/assets/company-logo.png\2', s)

with open(path, "w", encoding="utf-8") as f:
    f.write(s)
print(path)
PY
  fi

  # Make the images fill their containers, so we don't show the old gradient background around them.
  CSS="$(ls -1 "${WEBSITE_DIST}/assets"/index-*.css 2>/dev/null | head -n 1 || true)"
  if [[ -n "${CSS}" && -f "${CSS}" ]]; then
    python3 - "${CSS}" <<'PY'
import sys

css_path = sys.argv[1]
with open(css_path, "r", encoding="utf-8") as f:
    s = f.read()

# Remove the gradient background behind the injected image.
s = s.replace(
    "background:linear-gradient(135deg,var(--primary),var(--secondary));",
    "background:transparent;"
)

# Make inner images fill the container.
s = s.replace(
    "}.logo-icon .logo-img{width:72%;height:72%;object-fit:contain;display:block}",
    "}.logo-icon .logo-img{width:100%;height:100%;object-fit:cover;display:block}",
)
s = s.replace(
    "}.app-logo .app-logo-img{width:70%;height:70%;object-fit:contain;display:block}",
    "}.app-logo .app-logo-img{width:100%;height:100%;object-fit:cover;display:block}",
)

with open(css_path, "w", encoding="utf-8") as f:
    f.write(s)
print(css_path)
PY
  fi
fi

echo "Done."
