import { FO_ROW_PITCH } from '../core/layout/firstOne';
import { SH_FACET } from '../core/layout/secondHigh';
import type { Layout, ProductSpec } from '../core/types';

/**
 * Shared SVG <defs>: things defined ONCE and instanced per tile with <use> or
 * clip-path, keeping the per-tile DOM cost tiny even at 5,000 tiles.
 *
 * - pp-facet: Second High's faceted surface as translucent shading triangles,
 *   used ONLY when no photo is available. Its lighting matches the photography
 *   (bright on the top-left facets, dark below the ridge) — like the photos, it
 *   is drawn in the tile's one fixed orientation and never turned.
 * - pp-bands: Basic Third's three vertical relief bands.
 * - pp-marble-fade: Basic Third's subtle top-to-bottom colour fade, spanning
 *   the whole wall in absolute (userSpaceOnUse) coordinates so every course's
 *   tint lines up into one continuous gradient rather than repeating per tile.
 * - pp-wall-clip: wall rectangle, applied to cut edge tiles.
 * - pp-diamond: First One's visible rhombus at the origin — each photographed
 *   diamond tile translates this clip to its centre, so the photo never paints
 *   over its neighbours.
 */

const FO_HALF_W = 152;

export function SceneDefs({ product, layout }: { product: ProductSpec; layout: Layout }) {
  const { size, ax, ay } = SH_FACET;
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
        <>
          <g id="pp-bands">
            {thirds.map((x) => (
              <g key={x}>
                <rect x={x - bandW / 2} y={0} width={bandW} height={product.tile.h} fill="#000000" opacity={0.13} />
                <rect x={x + bandW / 2} y={0} width={2.5} height={product.tile.h} fill="#ffffff" opacity={0.09} />
              </g>
            ))}
          </g>
          <linearGradient
            id="pp-marble-fade"
            gradientUnits="userSpaceOnUse"
            x1={0}
            y1={0}
            x2={0}
            y2={layout.wallH}
          >
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.1} />
            <stop offset="50%" stopColor="#ffffff" stopOpacity={0} />
            <stop offset="100%" stopColor="#000000" stopOpacity={0.12} />
          </linearGradient>
        </>
      )}
    </defs>
  );
}
