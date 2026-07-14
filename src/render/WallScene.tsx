import type { Cell, Layout, ProductSpec } from '../core/types';
import { materialAt } from '../data/palette';
import { SceneDefs } from './defs';
import type { TextureMap } from './textures';
import { resolveTexture, toneJitterFor, variantFor } from './textures';
import { TileShape } from './TileShape';

/**
 * The one and only wall renderer. The live preview, the SVG export and the
 * PNG/JPEG rasterization all render THIS component (exports via
 * renderToStaticMarkup), so screen and files can never drift apart.
 *
 * Coordinates are real-world mm (1 SVG unit = 1 mm); width/height props set
 * the presentation size.
 *
 * The wall is tileable by construction (wrap-partner tiles share a colour). The
 * live preview uses that to FILL the viewport edge-to-edge (no black bars): it
 * passes a `view` bigger than the wall and `tileOffsets` to repeat the pattern
 * across it, plus `frame` to outline the actual wall the user set. Exports omit
 * all three, so they render exactly the one wall.
 */

export const WALL_BG = '#26282b'; // literal (not a CSS var) so exports carry it

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface WallSceneProps {
  layout: Layout;
  cells: readonly Cell[];
  product: ProductSpec;
  textures: TextureMap;
  /** Design seed — drives which photo variant (and tone nudge) each tile gets. */
  seed: number;
  width?: string | number;
  height?: string | number;
  /** Visible region in mm (defaults to just the wall). */
  view?: ViewBox;
  /** Tile-layer offsets in mm to repeat the pattern across the view. */
  tileOffsets?: ReadonlyArray<readonly [number, number]>;
  /** Draw the wall boundary outline and dim the fill outside it. */
  frame?: boolean;
  preserveAspectRatio?: string;
}

export function WallScene({
  layout,
  cells,
  product,
  textures,
  seed,
  width,
  height,
  view,
  tileOffsets,
  frame,
  preserveAspectRatio = 'xMidYMid meet',
}: WallSceneProps) {
  const { wallW, wallH } = layout;
  const v: ViewBox = view ?? { x: 0, y: 0, w: wallW, h: wallH };
  const offsets = tileOffsets ?? [[0, 0]];

  const tiles = layout.tiles.map((tile, i) => {
    const cell = cells[tile.cellIndex];
    const material = materialAt(cell?.material ?? 0);
    const resolved = resolveTexture(textures, product.id, material.id);
    return (
      <TileShape
        key={i}
        tile={tile}
        material={material}
        texUrl={
          resolved ? variantFor(resolved.urls, seed, tile.patternRow, tile.patternCol) : null
        }
        texBorrowed={resolved ? !resolved.native : false}
        toneJitter={toneJitterFor(seed, tile.patternRow, tile.patternCol)}
        productId={product.id}
      />
    );
  });

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`}
      width={width}
      height={height}
      preserveAspectRatio={preserveAspectRatio}
    >
      <SceneDefs product={product} layout={layout} />
      {/* backing fills the whole visible region so repeats sit on the same ground */}
      <rect x={v.x} y={v.y} width={v.w} height={v.h} fill={WALL_BG} />
      {offsets.map(([dx, dy], oi) =>
        dx === 0 && dy === 0 ? (
          <g key={oi}>{tiles}</g>
        ) : (
          <g key={oi} transform={`translate(${dx} ${dy})`}>
            {tiles}
          </g>
        ),
      )}
      {frame && (
        <g pointerEvents="none">
          {/* dim everything outside the actual wall (rect-with-hole, even-odd) */}
          <path
            d={`M${v.x},${v.y} H${v.x + v.w} V${v.y + v.h} H${v.x} Z M0,0 H${wallW} V${wallH} H0 Z`}
            fillRule="evenodd"
            fill="rgba(0,0,0,0.5)"
          />
          {/* the "cutoff" frame: dark halo + bold white line, crisp at any zoom */}
          <rect
            x={0}
            y={0}
            width={wallW}
            height={wallH}
            fill="none"
            stroke="rgba(0,0,0,0.7)"
            strokeWidth={6}
            vectorEffect="non-scaling-stroke"
          />
          <rect
            x={0}
            y={0}
            width={wallW}
            height={wallH}
            fill="none"
            stroke="#ffffff"
            strokeWidth={2.5}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}
    </svg>
  );
}
