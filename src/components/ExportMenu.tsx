import { useState } from 'react';
import { trackDesignerEvent } from '../analytics';
import type { Cell, Layout, PatternConfig, ProductOptions, ProductSpec } from '../core/types';
import type { Order, Schedule } from '../core/schedule';
import type { DesignState } from '../core/state/reducer';
import type { TextureMap } from '../render/textures';
import { baseName } from '../export/download';
import type { ExportLead, LeadRequestContext } from '../embed/email';
import { designPhoto, exportNotificationEmail, submitEmail } from '../embed/email';
import { isChunkLoadError, reloadForNewDeploy } from '../embed/chunkReload';
import { shareUrl } from '../embed/share';
import { STR } from '../strings';

export interface ExportContext {
  product: ProductSpec;
  layout: Layout;
  cells: readonly Cell[];
  textures: TextureMap;
  options: ProductOptions;
  pattern: PatternConfig;
  schedule: Schedule;
  design: DesignState;
  order: Order;
}

type Format = 'png' | 'jpeg' | 'pdf' | 'laying';

const FORMATS: Array<{ id: Format; label: string; note: string }> = [
  { id: 'png', label: 'PNG', note: 'Image of your wall' },
  { id: 'jpeg', label: 'JPG', note: 'Image of your wall' },
  { id: 'pdf', label: 'PDF: render + tile spec sheet', note: 'Wall picture and tile list for quoting' },
  { id: 'laying', label: 'PDF: laying plan', note: 'A3: which tile goes where' },
];

const RASTER_PX_PER_MM = 1;
const RASTER_MAX_EDGE = 2200;

const dateLabel = () =>
  new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });

/**
 * Export dropdown. Each exporter is lazy-loaded on first use (dynamic import)
 * so the heavy PDF/DXF/rasterization code stays out of the initial embed.
 */
export function ExportMenu({
  ctx,
  requireLead,
}: {
  ctx: ExportContext;
  /** Shared with RequestButtons — asks once per tab (see ControlPanel). */
  requireLead: (
    label: string,
    onReady: (lead: ExportLead) => void,
    request?: LeadRequestContext,
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Format | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const formats = FORMATS;

  const scene = {
    product: ctx.product,
    layout: ctx.layout,
    cells: ctx.cells,
    textures: ctx.textures,
    options: ctx.options,
    pattern: ctx.pattern,
  };
  const name = baseName(ctx.product.id, ctx.layout.rows, ctx.layout.cols);

  function run(format: Format) {
    const label = formats.find((f) => f.id === format)?.label ?? format;
    requireLead(label, (lead) => void runExport(format, lead));
  }

  async function runExport(format: Format, currentLead: ExportLead) {
    setBusy(format);
    setMsg(null);
    try {
      switch (format) {
        case 'png':
        case 'jpeg': {
          const { exportRaster } = await import('../export/raster');
          const ext = format === 'jpeg' ? 'jpg' : 'png';
          const r = await exportRaster(scene, format, RASTER_PX_PER_MM, `${name}.${ext}`, {
            legend: ctx.schedule,
            maxEdge: RASTER_MAX_EDGE,
          });
          if (r.clamped) setMsg(`Image export was capped at ${RASTER_MAX_EDGE} px on the long edge.`);
          break;
        }
        case 'pdf': {
          const { exportPdf } = await import('../export/pdf');
          await exportPdf(scene, ctx.schedule, ctx.options, `${name}.pdf`, dateLabel(), ctx.design.repeat);
          break;
        }
        case 'laying': {
          const { exportLayingPlan } = await import('../export/layingPlan');
          exportLayingPlan(
            {
              product: ctx.product,
              layout: ctx.layout,
              cells: ctx.cells,
              options: ctx.options,
              schedule: ctx.schedule,
              order: ctx.order,
              design: ctx.design,
              lead: currentLead,
              dateLabel: dateLabel(),
            },
            `${name}_laying-plan.pdf`,
          );
          break;
        }
      }
      trackDesignerEvent('facade_designer_export', {
        product_id: ctx.product.id,
        export_format: format,
      });
      // Every format is a silent download, so let Pretty Plastic know it
      // happened, with a picture of the design. Best-effort — the visitor's
      // file already downloaded fine regardless of this.
      const label = formats.find((f) => f.id === format)?.label ?? format;
      const { subject, body } = exportNotificationEmail(
        currentLead,
        label,
        ctx.product,
        ctx.schedule,
        ctx.design,
      );
      void designPhoto(scene, ctx.schedule).then((photo) => submitEmail(subject, body, photo));
    } catch (err) {
      // Stale hashed chunk after a deploy — the tab still points at an old
      // /assets/*.js that 404s. Persist the design into the URL hash (same as
      // Share) so it survives the reload, then pick up the new build.
      if (isChunkLoadError(err)) {
        try {
          history.replaceState(null, '', shareUrl(ctx.design));
        } catch {
          /* iframe / history blocked — fall through to a manual reload ask */
        }
        setMsg('The designer was just updated — reloading…');
        if (!reloadForNewDeploy()) {
          setMsg(
            'The designer was just updated. Please reload this page and export again — your design is kept in the address bar if you used Share, or try Copy link first.',
          );
        }
        return;
      }
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
          {formats.map((f) => (
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
          {msg && <p className="warn">{msg}</p>}
        </div>
      )}
    </div>
  );
}
