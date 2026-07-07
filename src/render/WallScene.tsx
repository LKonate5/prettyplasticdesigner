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
    </svg>
  );
}
