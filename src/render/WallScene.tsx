import type { Cell, Layout, ProductSpec } from '../core/types';
import { materialAt } from '../data/palette';
import { SceneDefs } from './defs';
import type { TextureMap } from './textures';
import { resolveTexture, variantFor } from './textures';
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
  width?: string | number;
  height?: string | number;
  /** Visible region in mm (defaults to just the wall). */
  view?: ViewBox;
  /** Tile-layer offsets in mm to repeat the pattern across the view. */
  tileOffsets?: ReadonlyArray<readonly [number, number]>;
  /** Draw the wall boundary outline and dim the fill outside it. */
  frame?: boolean;
  /** Second High only: draw clickable row/column margins for bulk rotate. */
  rotateMargins?: boolean;
  preserveAspectRatio?: string;
}

const MARGIN_BAND = 40; // mm — width of the clickable row/column rotate strip

export function WallScene({
  layout,
  cells,
  product,
  textures,
  width,
  height,
  view,
  tileOffsets,
  frame,
  rotateMargins,
  preserveAspectRatio = 'xMidYMid meet',
}: WallSceneProps) {
  const { wallW, wallH } = layout;
  const v: ViewBox = view ?? { x: 0, y: 0, w: wallW, h: wallH };
  const offsets = tileOffsets ?? [[0, 0]];
  const margins = rotateMargins ? marginBounds(layout) : null;

  const tiles = layout.tiles.map((tile, i) => {
    const cell = cells[tile.cellIndex];
    const material = materialAt(cell?.material ?? 0);
    const resolved = resolveTexture(textures, product.id, material.id);
    return (
      <TileShape
        key={i}
        tile={tile}
        material={material}
        rotation={cell?.rotation ?? 0}
        texUrl={resolved ? variantFor(resolved.urls, tile.patternRow, tile.patternCol) : null}
        texBorrowed={resolved ? !resolved.native : false}
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
      {margins && (
        <g className="rotate-margins">
          {margins.rows.map(({ index, minY, maxY }) => (
            <g key={`row-${index}`} data-row={index} className="rotate-margin">
              <rect
                x={-MARGIN_BAND}
                y={minY}
                width={MARGIN_BAND}
                height={maxY - minY}
                className="rotate-margin-hit"
              />
              <text
                x={-MARGIN_BAND / 2}
                y={(minY + maxY) / 2}
                className="rotate-margin-glyph"
                pointerEvents="none"
              >
                ↻
              </text>
            </g>
          ))}
          {margins.cols.map(({ index, minX, maxX }) => (
            <g key={`col-${index}`} data-col={index} className="rotate-margin">
              <rect
                x={minX}
                y={-MARGIN_BAND}
                width={maxX - minX}
                height={MARGIN_BAND}
                className="rotate-margin-hit"
              />
              <text
                x={(minX + maxX) / 2}
                y={-MARGIN_BAND / 2}
                className="rotate-margin-glyph"
                pointerEvents="none"
              >
                ↻
              </text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

/** Per-row/column pixel bounds (mm), derived from the tile polygons so any
 * grid geometry works without duplicating layout-specific pitch math. */
function marginBounds(layout: Layout) {
  const rows = new Map<number, { minY: number; maxY: number }>();
  const cols = new Map<number, { minX: number; maxX: number }>();
  for (const tile of layout.tiles) {
    const xs = tile.polygon.map((p) => p[0]);
    const ys = tile.polygon.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const r = rows.get(tile.row);
    rows.set(tile.row, r ? { minY: Math.min(r.minY, minY), maxY: Math.max(r.maxY, maxY) } : { minY, maxY });
    const c = cols.get(tile.col);
    cols.set(tile.col, c ? { minX: Math.min(c.minX, minX), maxX: Math.max(c.maxX, maxX) } : { minX, maxX });
  }
  return {
    rows: [...rows.entries()].map(([index, b]) => ({ index, ...b })),
    cols: [...cols.entries()].map(([index, b]) => ({ index, ...b })),
  };
}
