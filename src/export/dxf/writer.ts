import type { Cell, Layout, Pt, ProductSpec } from '../../core/types';
import { materialAt, materialIndex } from '../../data/palette';
import { usedMaterialIds } from '../svg';
import { DxfBuilder } from './tags';

/**
 * Hand-rolled AC1015 (AutoCAD 2000) DXF writer.
 *
 * Why AC1015 and not a library: we emit exactly one entity type (closed
 * LWPOLYLINE) on named layers, so a full library is dead weight — and when a
 * CAD viewer is fussy, controlling every byte is the fastest way to fix it.
 *
 * Units: $INSUNITS = 4 (millimetres). This is the tag AutoCAD / Revit /
 * SketchUp read to auto-detect that the coordinates are in mm. Coordinates are
 * emitted y-up (DXF convention): y_dxf = wallH − y_svg.
 *
 * Layers: `0` and `PP_OUTLINE` (wall boundary), plus one per USED material
 * (PP_OCHRE_LIGHT …) coloured by its nearest ACI, with the exact hex attached
 * as a true-colour (group 420) on each entity for modern viewers.
 */

interface DxfLayer {
  name: string;
  aci: number;
  trueColour?: number; // 0xRRGGBB
}

export function buildDxf(product: ProductSpec, layout: Layout, cells: readonly Cell[]): string {
  const b = new DxfBuilder();
  const usedMaterials = usedMaterialIds(cells).map((id) => materialAt(materialIndex(id)));
  const layers: DxfLayer[] = [
    { name: '0', aci: 7 },
    { name: 'PP_OUTLINE', aci: 7 },
    ...usedMaterials.map((m) => ({
      name: m.dxfLayer,
      aci: m.aci,
      trueColour: hexToInt(m.hex),
    })),
  ];
  if (product.id === 'second-high') layers.push({ name: 'PP_FACETS', aci: 8 });

  // --- reserve handles for table records referenced by $HANDSEED bookkeeping
  writeHeader(b, layout);
  writeTables(b, layers);
  writeBlocks(b);
  writeEntities(b, product, layout, cells);
  writeObjects(b);
  b.tag(0, 'EOF');
  return b.toString();
}

function writeHeader(b: DxfBuilder, layout: Layout): void {
  b.section('HEADER');
  b.tag(9, '$ACADVER').tag(1, 'AC1015');
  b.tag(9, '$INSUNITS').tag(70, 4); // millimetres
  b.tag(9, '$MEASUREMENT').tag(70, 1); // metric
  b.tag(9, '$LUNITS').tag(70, 2); // decimal
  b.tag(9, '$EXTMIN').tag(10, 0).tag(20, 0).tag(30, 0);
  b.tag(9, '$EXTMAX').tag(10, layout.wallW).tag(20, layout.wallH).tag(30, 0);
  // $HANDSEED only has to exceed every handle used. Handles start at 0x100 and
  // a 5,000-tile wall (the cap) uses well under 0x10000, so a fixed high seed
  // is safely valid without a second pass.
  b.tag(9, '$HANDSEED').tag(5, 'FFFFFF');
  b.endSection();
}

function writeTables(b: DxfBuilder, layers: DxfLayer[]): void {
  b.section('TABLES');

  // VPORT
  b.tag(0, 'TABLE').tag(2, 'VPORT').tag(5, b.nextHandle()).tag(100, 'AcDbSymbolTable').tag(70, 1);
  b.tag(0, 'VPORT').tag(5, b.nextHandle()).tag(100, 'AcDbSymbolTableRecord')
    .tag(100, 'AcDbViewportTableRecord').tag(2, '*ACTIVE').tag(70, 0)
    .tag(10, 0).tag(20, 0).tag(11, 1).tag(21, 1).tag(12, 0).tag(22, 0)
    .tag(40, 1000).tag(41, 1.5).tag(42, 50).tag(43, 0).tag(44, 0)
    .tag(50, 0).tag(51, 0).tag(71, 0).tag(72, 100).tag(73, 1).tag(74, 3);
  b.tag(0, 'ENDTAB');

  // LTYPE — the three that AutoCAD always expects
  b.tag(0, 'TABLE').tag(2, 'LTYPE').tag(5, b.nextHandle()).tag(100, 'AcDbSymbolTable').tag(70, 3);
  for (const [name, desc] of [
    ['ByBlock', ''],
    ['ByLayer', ''],
    ['CONTINUOUS', 'Solid line'],
  ] as const) {
    b.tag(0, 'LTYPE').tag(5, b.nextHandle()).tag(100, 'AcDbSymbolTableRecord')
      .tag(100, 'AcDbLinetypeTableRecord').tag(2, name).tag(70, 0)
      .tag(3, desc).tag(72, 65).tag(73, 0).tag(40, 0);
  }
  b.tag(0, 'ENDTAB');

  // LAYER
  b.tag(0, 'TABLE').tag(2, 'LAYER').tag(5, b.nextHandle()).tag(100, 'AcDbSymbolTable').tag(70, layers.length);
  for (const layer of layers) {
    b.tag(0, 'LAYER').tag(5, b.nextHandle()).tag(100, 'AcDbSymbolTableRecord')
      .tag(100, 'AcDbLayerTableRecord').tag(2, layer.name).tag(70, 0)
      .tag(62, layer.aci).tag(6, 'CONTINUOUS');
    if (layer.trueColour !== undefined) b.tag(420, layer.trueColour);
    b.tag(370, 0); // default lineweight
  }
  b.tag(0, 'ENDTAB');

  // STYLE
  b.tag(0, 'TABLE').tag(2, 'STYLE').tag(5, b.nextHandle()).tag(100, 'AcDbSymbolTable').tag(70, 1);
  b.tag(0, 'STYLE').tag(5, b.nextHandle()).tag(100, 'AcDbSymbolTableRecord')
    .tag(100, 'AcDbTextStyleTableRecord').tag(2, 'STANDARD').tag(70, 0)
    .tag(40, 0).tag(41, 1).tag(50, 0).tag(71, 0).tag(42, 2.5).tag(3, 'txt').tag(4, '');
  b.tag(0, 'ENDTAB');

  // VIEW, UCS (empty but present)
  for (const name of ['VIEW', 'UCS'] as const) {
    b.tag(0, 'TABLE').tag(2, name).tag(5, b.nextHandle()).tag(100, 'AcDbSymbolTable').tag(70, 0);
    b.tag(0, 'ENDTAB');
  }

  // APPID
  b.tag(0, 'TABLE').tag(2, 'APPID').tag(5, b.nextHandle()).tag(100, 'AcDbSymbolTable').tag(70, 1);
  b.tag(0, 'APPID').tag(5, b.nextHandle()).tag(100, 'AcDbSymbolTableRecord')
    .tag(100, 'AcDbRegAppTableRecord').tag(2, 'ACAD').tag(70, 0);
  b.tag(0, 'ENDTAB');

  // DIMSTYLE (empty)
  b.tag(0, 'TABLE').tag(2, 'DIMSTYLE').tag(5, b.nextHandle()).tag(100, 'AcDbSymbolTable').tag(70, 0)
    .tag(100, 'AcDbDimStyleTable').tag(71, 0);
  b.tag(0, 'ENDTAB');

  // BLOCK_RECORD — must declare the two model/paper space records
  b.tag(0, 'TABLE').tag(2, 'BLOCK_RECORD').tag(5, b.nextHandle()).tag(100, 'AcDbSymbolTable').tag(70, 2);
  for (const name of ['*Model_Space', '*Paper_Space'] as const) {
    b.tag(0, 'BLOCK_RECORD').tag(5, b.nextHandle()).tag(100, 'AcDbSymbolTableRecord')
      .tag(100, 'AcDbBlockTableRecord').tag(2, name).tag(70, 0);
  }
  b.tag(0, 'ENDTAB');

  b.endSection();
}

function writeBlocks(b: DxfBuilder): void {
  b.section('BLOCKS');
  for (const [name, layer] of [
    ['*Model_Space', '0'],
    ['*Paper_Space', '0'],
  ] as const) {
    const h = b.nextHandle();
    b.tag(0, 'BLOCK').tag(5, h).tag(100, 'AcDbEntity').tag(8, layer)
      .tag(100, 'AcDbBlockBegin').tag(2, name).tag(70, 0)
      .tag(10, 0).tag(20, 0).tag(30, 0).tag(3, name).tag(1, '');
    b.tag(0, 'ENDBLK').tag(5, b.nextHandle()).tag(100, 'AcDbEntity').tag(8, layer).tag(100, 'AcDbBlockEnd');
  }
  b.endSection();
}

function writeEntities(
  b: DxfBuilder,
  product: ProductSpec,
  layout: Layout,
  cells: readonly Cell[],
): void {
  b.section('ENTITIES');
  const flipY = (p: Pt): Pt => [p[0], layout.wallH - p[1]];

  for (const tile of layout.tiles) {
    const material = materialAt(cells[tile.cellIndex]?.material ?? 0);
    lwpolyline(b, tile.exportPolygon.map(flipY), material.dxfLayer, hexToInt(material.hex), true);

    // Second High: emit the facet apex "V" so tile orientation survives in CAD.
    if (product.id === 'second-high') {
      const [x, y] = tile.polygon[0];
      const apex = facetApex(x, y, cells[tile.cellIndex]?.rotation ?? 0);
      lwpolyline(b, apex.map(flipY), 'PP_FACETS', undefined, false);
    }
  }

  // Wall boundary
  lwpolyline(
    b,
    (
      [
        [0, 0],
        [layout.wallW, 0],
        [layout.wallW, layout.wallH],
        [0, layout.wallH],
      ] as Pt[]
    ).map(flipY),
    'PP_OUTLINE',
    undefined,
    true,
  );

  b.endSection();
}

function lwpolyline(
  b: DxfBuilder,
  pts: Pt[],
  layer: string,
  trueColour: number | undefined,
  closed: boolean,
): void {
  b.tag(0, 'LWPOLYLINE').tag(5, b.nextHandle()).tag(100, 'AcDbEntity').tag(8, layer)
    .tag(100, 'AcDbPolyline').tag(90, pts.length).tag(70, closed ? 1 : 0);
  if (trueColour !== undefined) b.tag(420, trueColour);
  for (const [x, y] of pts) b.tag(10, x).tag(20, y);
}

function writeObjects(b: DxfBuilder): void {
  // Minimal root dictionary so AutoCAD is happy; one named-objects dict.
  b.section('OBJECTS');
  const root = b.nextHandle();
  const groupDict = b.nextHandle();
  b.tag(0, 'DICTIONARY').tag(5, root).tag(100, 'AcDbDictionary').tag(281, 1)
    .tag(3, 'ACAD_GROUP').tag(350, groupDict);
  b.tag(0, 'DICTIONARY').tag(5, groupDict).tag(102, '{ACAD_REACTORS').tag(330, root).tag(102, '}')
    .tag(100, 'AcDbDictionary').tag(281, 1);
  b.endSection();
}

// --- facet apex geometry (matches the on-screen motif in render/defs.tsx) ---
function facetApex(x: number, y: number, rotation: number): Pt[] {
  const s = 294;
  const ax = 182.28;
  const ay = 111.72;
  const corners: Pt[] = [
    [0, 0],
    [s, 0],
    [ax, ay],
  ];
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = s / 2;
  const cy = s / 2;
  return corners.map(([px, py]) => {
    const dx = px - cx;
    const dy = py - cy;
    return [x + cx + dx * cos - dy * sin, y + cy + dx * sin + dy * cos] as Pt;
  });
}

function hexToInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}
