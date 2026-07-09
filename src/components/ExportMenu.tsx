import { useState } from 'react';
import type { Cell, Layout, PatternConfig, ProductOptions, ProductSpec } from '../core/types';
import type { Schedule } from '../core/schedule';
import type { TextureMap } from '../render/textures';
import { baseName, downloadText } from '../export/download';
import { STR } from '../strings';

export interface ExportContext {
  product: ProductSpec;
  layout: Layout;
  cells: readonly Cell[];
  textures: TextureMap;
  options: ProductOptions;
  pattern: PatternConfig;
  schedule: Schedule;
}

type Format = 'png' | 'jpeg' | 'svg' | 'seamless' | 'dxf' | 'pdf' | 'glb' | 'obj';

const FORMATS: Array<{ id: Format; label: string; note: string }> = [
  { id: 'png', label: 'PNG image', note: 'Rendered wall, transparent-free raster' },
  { id: 'jpeg', label: 'JPEG image', note: 'Smaller file, white background' },
  { id: 'svg', label: 'SVG vector', note: 'True-mm scalable vector' },
  { id: 'seamless', label: 'Seamless texture (PNG)', note: 'Tileable repeat for 3D / render tools' },
  { id: 'dxf', label: 'DXF (2D CAD)', note: 'AutoCAD · Revit · SketchUp — mm, layer per colour' },
  { id: 'pdf', label: 'PDF spec sheet', note: 'Render + tile schedule for quoting' },
  { id: 'glb', label: '3D model (GLB)', note: 'Single file with colours — SketchUp · Blender · 3D viewers' },
  { id: 'obj', label: '3D model (OBJ + MTL)', note: 'Zipped OBJ+MTL — universal 3D interchange' },
];

// Scale presets in px per mm. 2 px/mm ≈ 200 dpi at real size — plenty for print.
const RASTER_PX_PER_MM = 2;

/**
 * Export dropdown. Each exporter is lazy-loaded on first use (dynamic import)
 * so the heavy PDF/DXF/rasterization code stays out of the initial embed.
 */
export function ExportMenu({ ctx }: { ctx: ExportContext }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Format | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const scene = {
    product: ctx.product,
    layout: ctx.layout,
    cells: ctx.cells,
    textures: ctx.textures,
    options: ctx.options,
    pattern: ctx.pattern,
  };
  const name = baseName(ctx.product.id, ctx.layout.rows, ctx.layout.cols);

  async function run(format: Format) {
    setBusy(format);
    setMsg(null);
    try {
      switch (format) {
        case 'png':
        case 'jpeg': {
          const { exportRaster } = await import('../export/raster');
          const r = await exportRaster(scene, format, RASTER_PX_PER_MM, `${name}.${format}`);
          if (r.clamped) setMsg('Large wall — image was capped at 8192 px on the long edge.');
          break;
        }
        case 'svg': {
          const { buildSceneSvg } = await import('../export/svg');
          downloadText(await buildSceneSvg(scene), `${name}.svg`, 'image/svg+xml');
          break;
        }
        case 'seamless': {
          const { exportSeamless } = await import('../export/raster');
          const out = await exportSeamless(scene, RASTER_PX_PER_MM, `${name}_seamless.png`);
          if (!out.ok) setMsg(out.reason ?? 'Could not create a seamless tile.');
          else if (out.result?.clamped) setMsg('Repeat was capped at 8192 px on the long edge.');
          break;
        }
        case 'dxf': {
          const { buildDxf } = await import('../export/dxf/writer');
          downloadText(buildDxf(ctx.product, ctx.layout, ctx.cells), `${name}.dxf`, 'application/dxf');
          break;
        }
        case 'pdf': {
          const { exportPdf } = await import('../export/pdf');
          const dateLabel = new Date().toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
          await exportPdf(scene, ctx.schedule, ctx.options, `${name}.pdf`, dateLabel);
          break;
        }
        case 'glb': {
          const [{ buildWallMesh }, { buildGlb }, { downloadBlob }] = await Promise.all([
            import('../export/mesh'),
            import('../export/glb'),
            import('../export/download'),
          ]);
          const mesh = buildWallMesh(ctx.product, ctx.layout, ctx.cells);
          const glb = buildGlb(mesh);
          downloadBlob(new Blob([glb], { type: 'model/gltf-binary' }), `${name}.glb`);
          break;
        }
        case 'obj': {
          const [{ buildWallMesh }, { buildObj }, { makeZip }, { downloadBlob }] = await Promise.all([
            import('../export/mesh'),
            import('../export/obj'),
            import('../export/zip'),
            import('../export/download'),
          ]);
          const mesh = buildWallMesh(ctx.product, ctx.layout, ctx.cells);
          const { obj, mtl } = buildObj(mesh, `${name}.mtl`);
          const zip = makeZip([
            { name: `${name}.obj`, text: obj },
            { name: `${name}.mtl`, text: mtl },
          ]);
          downloadBlob(zip, `${name}_obj.zip`);
          break;
        }
      }
    } catch (err) {
      setMsg(`Export failed: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="section">
      <button className="btn primary" style={{ width: '100%' }} onClick={() => setOpen((o) => !o)}>
        {STR.export} ▾
      </button>
      {open && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {FORMATS.map((f) => (
            <button
              key={f.id}
              className="btn"
              style={{ textAlign: 'left' }}
              disabled={busy !== null}
              onClick={() => run(f.id)}
            >
              <strong>{busy === f.id ? 'Working…' : f.label}</strong>
              <br />
              <small style={{ color: 'var(--pp-muted)' }}>{f.note}</small>
            </button>
          ))}
          <p className="note">
            SketchUp (.skp) and Revit (.rvt) can’t be written in a browser — for 3D import the GLB or
            OBJ, for 2D the DXF. They open cleanly in both.
          </p>
          {msg && <p className="warn">{msg}</p>}
        </div>
      )}
    </div>
  );
}
