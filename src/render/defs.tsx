import { FO_ROW_PITCH } from '../core/layout/firstOne';
import type { Layout, ProductSpec } from '../core/types';

/**
 * Shared SVG <defs>: things defined ONCE and instanced per tile with <use> or
 * clip-path, keeping the per-tile DOM cost tiny even at 5,000 tiles.
 *
 * - pp-facet: Second High's faceted surface as translucent shading triangles
 *   (used when no photo is available). The apex is deliberately off-centre so
 *   all four rotations look different. Material-independent.
 * - pp-bands: Basic Third's three vertical relief bands (no-photo fallback).
 * - pp-wall-clip: wall rectangle, applied to cut edge tiles.
 * - pp-diamond: First One's visible rhombus at the origin — each photographed
 *   diamond tile translates this clip to its centre, so the photo never paints
 *   over its neighbours.
 */

const FACET = { size: 294, ax: 182.28, ay: 111.72 };
const FO_HALF_W = 152;

export function SceneDefs({ product, layout }: { product: ProductSpec; layout: Layout }) {
  const { size, ax, ay } = FACET;
  const bandW = 6;
  const thirds = [product.tile.w / 3, (2 * product.tile.w) / 3];
  const rp = FO_ROW_PITCH;
  return (
    <defs>
      <clipPath id="pp-wall-clip">
        <rect x={0} y={0} width={layout.wallW} height={layout.wallH} />
      </clipPath>
      {product.id === 'first-one' && (
        <clipPath id="pp-diamond">
          <polygon points={`0,${-rp} ${FO_HALF_W},0 0,${rp} ${-FO_HALF_W},0`} />
        </clipPath>
      )}
      {product.id === 'second-high' && (
        <g id="pp-facet">
          <polygon points={`0,0 ${size},0 ${ax},${ay}`} fill="#ffffff" opacity={0.2} />
          <polygon points={`${size},0 ${size},${size} ${ax},${ay}`} fill="#000000" opacity={0.1} />
          <polygon points={`${size},${size} 0,${size} ${ax},${ay}`} fill="#000000" opacity={0.22} />
          <polygon points={`0,${size} 0,0 ${ax},${ay}`} fill="#ffffff" opacity={0.07} />
        </g>
      )}
      {product.id === 'basic-third' && (
        <g id="pp-bands">
          {thirds.map((x) => (
            <g key={x}>
              <rect x={x - bandW / 2} y={0} width={bandW} height={product.tile.h} fill="#000000" opacity={0.13} />
              <rect x={x + bandW / 2} y={0} width={2.5} height={product.tile.h} fill="#ffffff" opacity={0.09} />
            </g>
          ))}
        </g>
      )}
    </defs>
  );
}
