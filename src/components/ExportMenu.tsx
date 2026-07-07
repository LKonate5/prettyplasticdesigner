import { useState } from 'react';
import type { Cell, Layout, ProductSpec } from '../core/types';
import type { TextureMap } from '../render/textures';
import { STR } from '../strings';

export interface ExportContext {
  product: ProductSpec;
  layout: Layout;
  cells: readonly Cell[];
  textures: TextureMap;
}

/**
 * Export dropdown. The heavy exporter code is lazy-loaded on first use
 * (dynamic import) so the initial embed stays light. Real implementations
 * land in M6 (SVG/PNG/JPEG/seamless) and M7 (DXF/PDF); until then the entries
 * are visible but disabled with a note.
 */
export function ExportMenu({ ctx }: { ctx: ExportContext }) {
  const [open, setOpen] = useState(false);
  void ctx;
  return (
    <div className="section">
      <button className="btn primary" style={{ width: '100%' }} onClick={() => setOpen((o) => !o)}>
        {STR.export} ▾
      </button>
      {open && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p className="note">Export formats are being wired up (M6–M7).</p>
        </div>
      )}
    </div>
  );
}
