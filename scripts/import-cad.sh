#!/bin/bash
# Package Pretty Plastic's real CAD documentation into per-product download packs.
#
# Same shape as scripts/import-textures.sh: the raw source folder (autocad/, ~51 MB,
# gitignored) stays local, and this script generates the committed, servable
# artefacts under public/cad/:
#     public/cad/{product}.zip      the pack an architect downloads
#     public/cad/manifest.json      { "productId": { bytes, files } }
# The app reads the manifest at startup and only offers the CAD download for
# products that actually have a pack (see src/render/cad.ts).
#
# What goes in a pack: the DWG details, the dimension drawings (DWG + PDF) and
# the 3D models (SKP / STL / IFC). Deliberately EXCLUDED: the marketing colour
# PNGs under "First One PNGs" (~25 MB of swatch renders, not CAD) — they would
# quadruple the pack for no value to someone opening it in AutoCAD or Revit.
#
# Re-runnable: wipes and rebuilds public/cad each time.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC="autocad"
OUT="public/cad"

if [ ! -d "$SRC" ]; then
  echo "No $SRC/ directory — nothing to package." >&2
  exit 0
fi

rm -rf "$OUT"
mkdir -p "$OUT"

manifest="{"
sep=""

pack() {
  # $1 product-id   $2... source directories (relative to autocad/)
  local product="$1"
  shift
  local staging
  staging="$(mktemp -d)"
  local found=0

  for dir in "$@"; do
    if [ -d "$SRC/$dir" ]; then
      # flatten one level: "First One - DWG/Details 1_5" → "Details 1_5"
      cp -R "$SRC/$dir" "$staging/$(basename "$dir")"
      found=1
    fi
  done

  if [ "$found" -eq 0 ]; then
    echo "  $product: no source folders found — skipped"
    rm -rf "$staging"
    return
  fi

  # Drop macOS cruft and the repeated Pretty Plastic logo bitmap that ships
  # alongside every drawing folder.
  find "$staging" \( -name '.DS_Store' -o -name 'logo *.png' \) -delete

  local dest
  dest="$PWD/$OUT/$product.zip"
  (cd "$staging" && zip -qr9 "$dest" .)
  rm -rf "$staging"

  local bytes files
  bytes="$(wc -c <"$OUT/$product.zip" | tr -d ' ')"
  files="$(unzip -l "$OUT/$product.zip" | tail -1 | awk '{print $2}')"
  manifest+="${sep}\"$product\":{\"bytes\":$bytes,\"files\":$files}"
  sep=","
  echo "  $product: $files files, $(( bytes / 1024 )) KB"
}

echo "Packaging CAD downloads…"
pack "first-one" \
  "05 AutoCad/First One - DWG" \
  "05 AutoCad/First One - PDF" \
  "05 AutoCad/First One - 3D Model"

pack "second-high" \
  "Second High - DWG" \
  "Second High - 3D Model"

pack "basic-third" \
  "Basic Third - DWG - 3D Model"

manifest+="}"
printf '%s\n' "$manifest" >"$OUT/manifest.json"
echo ""
echo "Wrote $OUT/manifest.json"
