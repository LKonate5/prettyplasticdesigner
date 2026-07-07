import type { Cell, Layout, ProductSpec } from '../core/types';
import { materialAt } from '../data/palette';
import { SceneDefs } from './defs';
import type { TextureMap } from './textures';
import { textureKey } from './textures';
import { TileShape } from './TileShape';

/**
 * The one and only wall renderer. The live preview, the SVG export and the
 * PNG/JPEG rasterization all render THIS component (exports via
 * renderToStaticMarkup), so screen and files can never drift apart.
 *
 * Coordinates are real-world mm (1 SVG unit = 1 mm); width/height props set
 * the presentation size.
 *
 * `repeat` (seamless export only): draw the tile layer at a 3×3 grid of
 * ±period offsets so tiles straddling an edge reappear on the opposite side —
 * the crop is then perfectly tileable in geometry AND colour. defs and the
 * background are drawn once.
 */

export const WALL_BG = '#26282b'; // literal (not a CSS var) so exports carry it

interface WallSceneProps {
  layout: Layout;
  cells: readonly Cell[];
  product: ProductSpec;
  textures: TextureMap;
  width?: string | number;
  height?: string | number;
  repeat?: { w: number; h: number };
}

export function WallScene({
  layout,
  cells,
  product,
  textures,
  width,
  height,
  repeat,
}: WallSceneProps) {
  const tiles = (
    <g>
      {layout.tiles.map((tile) => {
        const cell = cells[tile.cellIndex];
        const material = materialAt(cell?.material ?? 0);
        return (
          <TileShape
            key={tile.cellIndex}
            tile={tile}
            material={material}
            rotation={cell?.rotation ?? 0}
            texUrl={textures.get(textureKey(product.id, material.id)) ?? null}
            productId={product.id}
          />
        );
      })}
    </g>
  );

  const offsets = repeat
    ? [-1, 0, 1].flatMap((iy) => [-1, 0, 1].map((ix) => [ix * repeat.w, iy * repeat.h] as const))
    : [[0, 0] as const];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${layout.wallW} ${layout.wallH}`}
      width={width}
      height={height}
      preserveAspectRatio="xMidYMid meet"
    >
      <SceneDefs product={product} layout={layout} textures={textures} />
      <rect x={0} y={0} width={layout.wallW} height={layout.wallH} fill={WALL_BG} />
      {offsets.map(([dx, dy], i) =>
        dx === 0 && dy === 0 ? (
          <g key={i}>{tiles}</g>
        ) : (
          <g key={i} transform={`translate(${dx} ${dy})`}>
            {tiles}
          </g>
        ),
      )}
    </svg>
  );
}
