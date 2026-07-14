import { memo } from 'react';
import type { Material, Pt, Rotation, Tile } from '../core/types';

const fmt = (n: number): string => {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
};

export const pointsAttr = (poly: Pt[]): string =>
  poly.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(' ');

const SHADOW_FILL = 'rgba(0,0,0,0.18)';

// First One photo placement (photos are ~1785×2400: the full 304×400 mm
// physical diamond incl. its hidden top lap, on a backdrop). The image is
// scaled slightly past the visible rhombus and bottom-anchored, then clipped
// by #pp-diamond so the photo always covers the tile with no backdrop slivers.
const FO_IMG_W = 316; // 304 mm × ~4% overscan
const FO_IMG_H = FO_IMG_W * (2400 / 1785);
const FO_IMG_BOTTOM = 154; // rhombus bottom vertex ≈ +148.2, plus a little bleed

interface TileShapeProps {
  tile: Tile;
  material: Material;
  rotation: Rotation;
  /** Photo variant URL for this tile, or null → flat hex fill. */
  texUrl: string | null;
  productId: string;
}

/**
 * One tile. Memoized — during painting only the touched tile re-renders.
 * Cut edge tiles draw their full shape and get clipped by the shared wall
 * clipPath, so overlays (facets, bands, photos) are cut with the tile.
 *
 * With a real photo: Second High draws the square photo directly (rotating
 * with the tile); First One draws the diamond photo clipped to the shared
 * #pp-diamond rhombus; Basic Third (when photos arrive) covers its rect.
 * Without: hex fill + the procedural facet/band overlays.
 */
export const TileShape = memo(function TileShape({
  tile,
  material,
  rotation,
  texUrl,
  productId,
}: TileShapeProps) {
  const [x, y] = tile.polygon[0];
  const second = productId === 'second-high';
  const size = 294;

  let content;
  if (texUrl && second) {
    // texture must rotate with the tile, so draw the image directly
    content = (
      <image
        href={texUrl}
        x={x}
        y={y}
        width={size}
        height={size}
        transform={rotation ? `rotate(${rotation} ${x + size / 2} ${y + size / 2})` : undefined}
        preserveAspectRatio="xMidYMid slice"
      />
    );
  } else if (texUrl && productId === 'first-one') {
    // polygon[0] = top vertex (cx, cy−RP); polygon[2] = bottom vertex (cx, cy+RP)
    const cx = tile.polygon[0][0];
    const cy = (tile.polygon[0][1] + tile.polygon[2][1]) / 2;
    content = (
      <g transform={`translate(${fmt(cx)} ${fmt(cy)})`} clipPath="url(#pp-diamond)">
        <image
          href={texUrl}
          x={-FO_IMG_W / 2}
          y={FO_IMG_BOTTOM - FO_IMG_H}
          width={FO_IMG_W}
          height={FO_IMG_H}
          preserveAspectRatio="xMidYMid slice"
        />
      </g>
    );
  } else if (texUrl && productId === 'basic-third') {
    const w = tile.polygon[1][0] - tile.polygon[0][0];
    const h = tile.polygon[2][1] - tile.polygon[1][1];
    content = (
      <image href={texUrl} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid slice" />
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

  return (
    <g data-cell={tile.cellIndex} clipPath={tile.cut ? 'url(#pp-wall-clip)' : undefined}>
      {content}
      {second && !texUrl && (
        <use
          href="#pp-facet"
          transform={`translate(${fmt(x)} ${fmt(y)})${
            rotation ? ` rotate(${rotation} ${size / 2} ${size / 2})` : ''
          }`}
        />
      )}
      {productId === 'basic-third' && !texUrl && (
        <use href="#pp-bands" transform={`translate(${fmt(x)} ${fmt(y)})`} />
      )}
      {tile.shadowStrips.map((strip, i) => (
        <polygon key={i} points={pointsAttr(strip)} fill={SHADOW_FILL} />
      ))}
    </g>
  );
});
