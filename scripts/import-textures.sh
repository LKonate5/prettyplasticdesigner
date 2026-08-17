#!/bin/bash
# Import the real tile photos from images/ into the app.
#
# Reads Pretty Plastic's photo naming (SECOND_HIGH_o1_… / FIRST_ONE_b3_… /
# BASIC_THIRD_O1_…), decodes colour (o=ochre t=terracotta g=green b=grey) and
# shade (1=light 2=medium 3=dark), downscales every photo to max 512px and
# converts to JPEG (sips, macOS built-in; JPEG keeps the app ~6× lighter and
# the renderer clips tiles to shape so transparency isn't needed) and writes
# them to:
#     public/textures/{product}/{colour}-{shade}-{NN}.jpg
# plus public/textures/manifest.json with the variant count per material —
# the app loads that manifest instead of probing hundreds of URLs.
#
# Filenames aren't consistently cased across drops (Basic Third's arrived as
# BASIC_THIRD_O1_B.png — uppercase colour+shade — unlike the lower-case
# SECOND_HIGH_o1_… / FIRST_ONE_b3_… convention), so matching is case-insensitive.
#
# Re-runnable: wipes and rebuilds each product folder — but ONLY the ones
# whose source directory actually exists on this machine. images/ is
# gitignored (raw photos stay local, never committed), so on a fresh checkout
# most of these source dirs are simply absent; wiping a product's committed
# public/textures/ output when there's nothing to regenerate it from would
# silently destroy tracked assets instead of leaving them alone.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC_SH="images/LowRes sRGB PNG rev01"
SRC_FO="images/LowRes sRGB png"
SRC_BT="images/LowRes sRGB Basic Third"
OUT="public/textures"
MAX_PX=512

colour_name() { case "$1" in o) echo ochre ;; t) echo terracotta ;; g) echo green ;; b) echo grey ;; esac; }
shade_name() { case "$1" in 1) echo light ;; 2) echo medium ;; 3) echo dark ;; esac; }

[ -d "$SRC_SH" ] && rm -rf "$OUT/second-high" && mkdir -p "$OUT/second-high"
[ -d "$SRC_FO" ] && rm -rf "$OUT/first-one" && mkdir -p "$OUT/first-one"
[ -d "$SRC_BT" ] && rm -rf "$OUT/basic-third" && mkdir -p "$OUT/basic-third"

# Carry forward manifest entries for any product whose source dir is missing
# here, rather than dropping them; entries for products being regenerated
# below (source dir present) are rebuilt from scratch.
carried=""
if [ -f "$OUT/manifest.json" ]; then
  while IFS= read -r entry; do
    [ -z "$entry" ] && continue
    key="$(echo "$entry" | cut -d'"' -f2)"
    case "$key" in
      second-high/*) [ -d "$SRC_SH" ] && continue ;;
      first-one/*) [ -d "$SRC_FO" ] && continue ;;
      basic-third/*) [ -d "$SRC_BT" ] && continue ;;
    esac
    carried="${carried}${carried:+,}${entry}"
  done < <(sed 's/^{//;s/}$//' "$OUT/manifest.json" | tr ',' '\n')
fi

manifest="{${carried}"
sep="${carried:+,}"

import_set() {
  # $1 product-id  $2 source-dir  $3 filename-pattern  $4 material name
  local product="$1" dir="$2" name="$3" mat="$4" n=0 f
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    n=$((n + 1))
    sips -Z "$MAX_PX" -s format jpeg -s formatOptions 75 "$f" \
      --out "$OUT/$product/${mat}-$(printf '%02d' "$n").jpg" >/dev/null
  done < <(find "$dir" -type f -iname "$name" 2>/dev/null | sort)
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
    import_set "basic-third" "$SRC_BT" "BASIC_THIRD_${c}${s}_*.png" "$mat"
  done
done

manifest+="}"
printf '%s\n' "$manifest" >"$OUT/manifest.json"
echo ""
echo "Wrote $OUT/manifest.json"
