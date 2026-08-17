import { memo } from 'react';
import { BT_H, BT_W } from '../core/layout/basicThird';
import type { Material, Pt, Tile, TileRotation } from '../core/types';

const fmt = (n: number): string => {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
};

export const pointsAttr = (poly: Pt[]): string =>
  poly.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(' ');

// Shared by every product's shadowStrips (Basic Third's single lap band,
// First One's nested ones — see lapShadowBands in layout/firstOne.ts). First
// One stacks several bands of this same fill via normal alpha compositing, so
// its lap reads as a soft falloff rather than one flat stripe.
const SHADOW_FILL = 'rgba(0,0,0,0.18)';
// The lapping tile's own edge, catching the light (tile.lipStrips). Paired with
// the shadow above it across the lap line — see layout/firstOne.ts.
const LIP_FILL = 'rgba(255,255,255,0.16)';

// Ceiling on the per-tile tone nudge (see toneJitterFor in textures.ts): a ±4%
// black/white wash. Enough to stop a material with only one photo reading as a
// stamped repeat, small enough that it never fights the photo's own lighting.
const TONE_JITTER = 0.04;

// First One photo placement (photos are ~1785×2400: the full 304×400 mm
// physical diamond incl. its hidden top lap, on a backdrop). The image is
// scaled slightly past the visible rhombus and bottom-anchored, then clipped
// by #pp-diamond so the photo always covers the tile with no backdrop slivers.
export const SECOND_HIGH_IMG_SIZE = 294;
export const FO_IMG_W = 316; // 304 mm × ~4% overscan
export const FO_IMG_H = FO_IMG_W * (2400 / 1785);
export const FO_IMG_BOTTOM = 154; // rhombus bottom vertex ≈ +148.2, plus a little bleed

interface TileShapeProps {
  tile: Tile;
  material: Material;
  /** Photo variant URL for this tile, or null → flat hex fill. */
  texUrl: string | null;
  /** Optional SVG <defs> id for texUrl, avoiding duplicated base64 payloads in exports. */
  texId?: string;
  /** True when texUrl is borrowed from a sibling product's photos (see PHOTO_FALLBACK). */
  texBorrowed: boolean;
  /** −1..1 tone nudge for this tile (see toneJitterFor); scaled by TONE_JITTER. */
  toneJitter: number;
  productId: string;
  rotation: TileRotation;
}

/**
 * One tile. Memoized — during painting only the touched tile re-renders.
 * Cut edge tiles draw their full shape and get clipped by the shared wall
 * clipPath, so overlays (facets, bands, photos) are cut with the tile.
 *
 * Second High may rotate as a physical design choice, so its photo and facet
 * transform together. First One keeps its hanging nose to the north. Basic
 * Third's tile is a plain rect, so its photo (when available) is drawn as a
 * simple axis-aligned crop — no clip path needed. Without a photo, any
 * product falls back to its flat hex fill; Second High adds #pp-facet and
 * Basic Third adds a subtle #pp-marble-fade tint plus its 3 vertical relief
 * bands (#pp-bands) standing in for the grooved 3-slat profile.
 */
export const TileShape = memo(function TileShape({
  tile,
  material,
  texUrl,
  texId,
  toneJitter,
  productId,
  rotation,
}: TileShapeProps) {
  const [x, y] = tile.polygon[0];
  const second = productId === 'second-high';
  const size = SECOND_HIGH_IMG_SIZE;
  const texHref = texId ? `#${texId}` : texUrl;

  let content;
  if (texHref && second) {
    content = texId ? (
      <use href={texHref} x={x} y={y} />
    ) : (
      <image
        href={texHref}
        x={x}
        y={y}
        width={size}
        height={size}
        preserveAspectRatio="xMidYMid slice"
      />
    );
  } else if (texUrl && productId === 'first-one') {
    // polygon[0] = top vertex (cx, cy−RP); polygon[2] = bottom vertex (cx, cy+RP)
    const cx = tile.polygon[0][0];
    const cy = (tile.polygon[0][1] + tile.polygon[2][1]) / 2;
    content = (
      <g transform={`translate(${fmt(cx)} ${fmt(cy)})`} clipPath="url(#pp-diamond)">
        {texId ? (
          <use href={texHref ?? ''} x={-FO_IMG_W / 2} y={FO_IMG_BOTTOM - FO_IMG_H} />
        ) : (
          <image
            href={texUrl}
            x={-FO_IMG_W / 2}
            y={FO_IMG_BOTTOM - FO_IMG_H}
            width={FO_IMG_W}
            height={FO_IMG_H}
            preserveAspectRatio="xMidYMid slice"
          />
        )}
      </g>
    );
  } else if (texUrl && productId === 'basic-third') {
    content = texId ? (
      <use href={texHref ?? ''} x={x} y={y} />
    ) : (
      <image
        href={texUrl}
        x={x}
        y={y}
        width={BT_W}
        height={BT_H}
        preserveAspectRatio="xMidYMid slice"
      />
    );
  } else {
    content = (
      <polygon
        points={pointsAttr(tile.polygon)}
        fill={material.hex}
        stroke={material.hex}
        strokeWidth={0.6}
      />
    );
  }

  const cx = x + size / 2;
  const cy = y + size / 2;
  const transform = second && rotation ? `rotate(${rotation} ${fmt(cx)} ${fmt(cy)})` : undefined;

  return (
    <g data-cell={tile.cellIndex} data-row={tile.row} data-col={tile.col} clipPath={tile.cut ? 'url(#pp-wall-clip)' : undefined}>
      <g transform={transform}>
      {content}
      {/* Tone nudge: keeps same-coloured photo tiles from reading as one stamp
          repeated. Lightness only — the relief and its light stay untouched. */}
      {texUrl && toneJitter !== 0 && (
        <polygon
          points={pointsAttr(tile.polygon)}
          fill={toneJitter > 0 ? '#ffffff' : '#000000'}
          opacity={fmt(Math.abs(toneJitter) * TONE_JITTER)}
        />
      )}
      {second && !texUrl && <use href="#pp-facet" transform={`translate(${fmt(x)} ${fmt(y)})`} />}
      {productId === 'basic-third' && !texUrl && (
        <>
          <rect
            x={x}
            y={y}
            width={tile.polygon[1][0] - tile.polygon[0][0]}
            height={tile.polygon[2][1] - tile.polygon[1][1]}
            fill="url(#pp-marble-fade)"
          />
          <use href="#pp-bands" transform={`translate(${fmt(x)} ${fmt(y)})`} />
        </>
      )}
      {tile.shadowStrips.map((strip, i) => (
        <polygon key={i} points={pointsAttr(strip)} fill={SHADOW_FILL} />
      ))}
      {tile.lipStrips.map((strip, i) => (
        <polygon key={`lip-${i}`} points={pointsAttr(strip)} fill={LIP_FILL} />
      ))}
      </g>
    </g>
  );
});
