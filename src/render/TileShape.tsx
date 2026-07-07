import { memo } from 'react';
import type { Material, Pt, Rotation, Tile } from '../core/types';

const fmt = (n: number): string => {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
};

export const pointsAttr = (poly: Pt[]): string =>
  poly.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(' ');

const SHADOW_FILL = 'rgba(0,0,0,0.18)';

interface TileShapeProps {
  tile: Tile;
  material: Material;
  rotation: Rotation;
  /** Data/object URL of this material's texture, or null → flat hex fill. */
  texUrl: string | null;
  productId: string;
}

/**
 * One tile. Memoized — during painting only the touched tile re-renders.
 * Cut edge tiles draw their full shape and get clipped by the shared wall
 * clipPath, so overlays (facets, bands) are cut with the tile.
 */
export const TileShape = memo(function TileShape({
  tile,
  material,
  rotation,
  texUrl,
  productId,
}: TileShapeProps) {
  const fill = texUrl ? `url(#pp-tex-${material.id})` : material.hex;
  const [x, y] = tile.polygon[0];
  const second = productId === 'second-high';
  const size = 294;
  return (
    <g data-cell={tile.cellIndex} clipPath={tile.cut ? 'url(#pp-wall-clip)' : undefined}>
      {second && texUrl ? (
        // texture must rotate with the tile, so draw the image directly
        <image
          href={texUrl}
          x={x}
          y={y}
          width={size}
          height={size}
          transform={rotation ? `rotate(${rotation} ${x + size / 2} ${y + size / 2})` : undefined}
          preserveAspectRatio="xMidYMid slice"
        />
      ) : (
        <polygon
          points={pointsAttr(tile.polygon)}
          fill={fill}
          stroke={texUrl ? undefined : material.hex}
          strokeWidth={texUrl ? undefined : 0.6}
        />
      )}
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
