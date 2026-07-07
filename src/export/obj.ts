import type { WallMesh } from './mesh';

/**
 * Wavefront OBJ + companion MTL. OBJ carries geometry and references material
 * colours from the .mtl, so the two ship together (zipped by the caller).
 * Y-up millimetres — matches the mesh frame and imports upright into SketchUp,
 * Blender, Rhino, etc.
 */
export function buildObj(mesh: WallMesh, mtlFilename: string): { obj: string; mtl: string } {
  const objLines: string[] = [
    '# Pretty Plastic Facade Designer — wall export (mm, Y-up)',
    `mtllib ${mtlFilename}`,
    'o PrettyPlasticWall',
  ];
  const mtlLines: string[] = ['# Pretty Plastic materials'];

  let vIndex = 1; // OBJ indices are 1-based
  const seenMtl = new Set<string>();

  for (const group of mesh.groups) {
    const mtlName = group.material.dxfLayer; // reuse the stable PP_* name
    if (!seenMtl.has(mtlName)) {
      seenMtl.add(mtlName);
      const [r, g, b] = rgb01(group.material.hex);
      mtlLines.push(
        `newmtl ${mtlName}`,
        `Kd ${f(r)} ${f(g)} ${f(b)}`,
        'Ka 0 0 0',
        'Ks 0.05 0.05 0.05',
        'Ns 8',
        'd 1',
        'illum 2',
      );
    }

    objLines.push(`usemtl ${mtlName}`);
    const triCount = group.positions.length / 9;
    for (let t = 0; t < triCount; t++) {
      const base = t * 9;
      const nb = t * 9;
      for (let k = 0; k < 3; k++) {
        const p = base + k * 3;
        objLines.push(
          `v ${f(group.positions[p])} ${f(group.positions[p + 1])} ${f(group.positions[p + 2])}`,
        );
        objLines.push(
          `vn ${f(group.normals[nb + k * 3])} ${f(group.normals[nb + k * 3 + 1])} ${f(
            group.normals[nb + k * 3 + 2],
          )}`,
        );
      }
      const a = vIndex;
      objLines.push(`f ${a}//${a} ${a + 1}//${a + 1} ${a + 2}//${a + 2}`);
      vIndex += 3;
    }
  }

  return { obj: objLines.join('\n') + '\n', mtl: mtlLines.join('\n') + '\n' };
}

function rgb01(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function f(n: number): string {
  return (Math.round(n * 1000) / 1000).toString();
}
