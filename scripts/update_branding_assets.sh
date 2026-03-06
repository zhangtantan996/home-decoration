#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

COMPANY_SRC="${ROOT}/docs/branding/company_logo.png"
APPICON_SRC="${ROOT}/docs/branding/app_icon.png"
WEB_FAVICON_SCRIPT="${ROOT}/scripts/generate_web_favicons.py"

if [[ ! -f "${COMPANY_SRC}" ]]; then
  echo "Missing ${COMPANY_SRC}"
  echo "Please add the company logo PNG (pure blue) at that path."
  exit 2
fi

if [[ ! -f "${APPICON_SRC}" ]]; then
  echo "Missing ${APPICON_SRC}"
  echo "Please add the app icon PNG (blue/white variant) at that path."
  exit 2
fi

if [[ ! -f "${WEB_FAVICON_SCRIPT}" ]]; then
  echo "Missing ${WEB_FAVICON_SCRIPT}"
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
  sips -s format png -z "${size}" "${size}" "${src}" --out "${out}" >/dev/null
}

to_png() {
  local src="$1"
  local out="$2"
  sips -s format png "${src}" --out "${out}" >/dev/null
}

echo "[1/5] web favicons + website brand source assets"
ADMIN_PUBLIC="${ROOT}/admin/public"
WEBSITE_IMAGES="${ROOT}/website/assets/images"
mkdir -p "${ADMIN_PUBLIC}" "${WEBSITE_IMAGES}"
python3 "${WEB_FAVICON_SCRIPT}" \
  --source "${COMPANY_SRC}" \
  --admin-public "${ADMIN_PUBLIC}" \
  --website-images "${WEBSITE_IMAGES}"
to_png "${COMPANY_SRC}" "${WEBSITE_IMAGES}/company-logo.png"
to_png "${APPICON_SRC}" "${WEBSITE_IMAGES}/app-icon.png"

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

echo "[5/5] website build note"
echo "Transparent favicons were generated into source assets. Re-run 'cd website && npm run build' to refresh compiled dist output."
echo "Done."
