#!/bin/bash
# Import the real tile photos from images/ into the app.
#
# Reads Pretty Plastic's photo naming (SECOND_HIGH_o1_… / FIRST_ONE_b3_…),
# decodes colour (o=ochre t=terracotta g=green b=grey) and shade (1=light
# 2=medium 3=dark), downscales every photo to max 512px and converts to JPEG
# (sips, macOS built-in; JPEG keeps the app ~6× lighter and the renderer clips
# tiles to shape so transparency isn't needed) and writes them to:
#     public/textures/{product}/{colour}-{shade}-{NN}.jpg
# plus public/textures/manifest.json with the variant count per material —
# the app loads that manifest instead of probing hundreds of URLs.
#
# Re-runnable: wipes and rebuilds the two product folders each time.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC_SH="images/LowRes sRGB PNG rev01"
SRC_FO="images/LowRes sRGB png"
OUT="public/textures"
MAX_PX=512

colour_name() { case "$1" in o) echo ochre ;; t) echo terracotta ;; g) echo green ;; b) echo grey ;; esac; }
shade_name() { case "$1" in 1) echo light ;; 2) echo medium ;; 3) echo dark ;; esac; }

rm -rf "$OUT/first-one" "$OUT/second-high"
mkdir -p "$OUT/first-one" "$OUT/second-high"

manifest="{"
sep=""

import_set() {
  # $1 product-id  $2 source-dir  $3 filename-pattern  $4 material name
  local product="$1" dir="$2" name="$3" mat="$4" n=0 f
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    n=$((n + 1))
    sips -Z "$MAX_PX" -s format jpeg -s formatOptions 75 "$f" \
      --out "$OUT/$product/${mat}-$(printf '%02d' "$n").jpg" >/dev/null
  done < <(find "$dir" -type f -name "$name" 2>/dev/null | sort)
  if [ "$n" -gt 0 ]; then
    manifest+="${sep}\"$product/$mat\":$n"
    sep=","
  fi
  echo "  $product/$mat: $n"
}

for c in o t g b; do
  for s in 1 2 3; do
    mat="$(colour_name "$c")-$(shade_name "$s")"
    import_set "second-high" "$SRC_SH" "SECOND_HIGH_${c}${s}_*.png" "$mat"
    import_set "first-one" "$SRC_FO" "FIRST_ONE_${c}${s}_*.png" "$mat"
  done
done

manifest+="}"
printf '%s\n' "$manifest" >"$OUT/manifest.json"
echo ""
echo "Wrote $OUT/manifest.json"
