import type { Layout, ProductSpec } from '../core/types';
import { MATERIALS } from '../data/palette';
import type { TextureMap } from './textures';
import { textureKey } from './textures';

/**
 * Shared SVG <defs>: things defined ONCE and instanced per tile with <use>,
 * keeping the per-tile DOM cost tiny even at 5,000 tiles.
 *
 * - pp-facet: Second High's faceted surface as translucent shading triangles.
 *   The apex is deliberately off-centre so all four rotations look different.
 *   Material-independent (white/black overlays work over any fill).
 * - pp-bands: Basic Third's three vertical relief bands, as two shaded
 *   separations plus highlight edges.
 * - pp-wall-clip: wall rectangle, applied to cut edge tiles.
 * - pp-tex-*: texture pattern fills for materials that have a real PNG.
 */

const FACET = { size: 294, ax: 182.28, ay: 111.72 };

export function SceneDefs({
  product,
  layout,
  textures,
}: {
  product: ProductSpec;
  layout: Layout;
  textures: TextureMap;
}) {
  const { size, ax, ay } = FACET;
  const bandW = 6;
  const thirds = [product.tile.w / 3, (2 * product.tile.w) / 3];
  return (
    <defs>
      <clipPath id="pp-wall-clip">
        <rect x={0} y={0} width={layout.wallW} height={layout.wallH} />
      </clipPath>
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
      {MATERIALS.map((mat) => {
        const url = textures.get(textureKey(product.id, mat.id));
        if (!url) return null;
        return (
          <pattern
            key={mat.id}
            id={`pp-tex-${mat.id}`}
            patternUnits="userSpaceOnUse"
            width={product.tile.w}
            height={product.tile.h}
          >
            <image
              href={url}
              width={product.tile.w}
              height={product.tile.h}
              preserveAspectRatio="xMidYMid slice"
            />
          </pattern>
        );
      })}
    </defs>
  );
}
