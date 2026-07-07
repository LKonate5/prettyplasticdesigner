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
 * The wall is tileable by construction (wrap-partner tiles share a colour), so
 * the seamless texture export just renders this scene and crops to one period.
 */

export const WALL_BG = '#26282b'; // literal (not a CSS var) so exports carry it

interface WallSceneProps {
  layout: Layout;
  cells: readonly Cell[];
  product: ProductSpec;
  textures: TextureMap;
  width?: string | number;
  height?: string | number;
}

export function WallScene({ layout, cells, product, textures, width, height }: WallSceneProps) {
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
      {layout.tiles.map((tile, i) => {
        const cell = cells[tile.cellIndex];
        const material = materialAt(cell?.material ?? 0);
        return (
          // key is the physical tile slot (i): wrap partners share cellIndex, so
          // cellIndex is NOT unique per tile and can't be the key.
          <TileShape
            key={i}
            tile={tile}
            material={material}
            rotation={cell?.rotation ?? 0}
            texUrl={textures.get(textureKey(product.id, material.id)) ?? null}
            productId={product.id}
          />
        );
      })}
    </svg>
  );
}
