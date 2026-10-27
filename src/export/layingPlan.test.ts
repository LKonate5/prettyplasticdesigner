import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeLayout } from '../core/layout';
import { generatePattern } from '../core/pattern/generators';
import { computeOrder, computeSchedule } from '../core/schedule';
import { initialDesign } from '../core/state/reducer';
import type { ProductId, ProductOptions } from '../core/types';
import { DEFAULT_OPTIONS, PRODUCTS } from '../data/products';
import { buildLayingPlanPdf, type LayingPlanInput } from './layingPlan';

function inputFor(
  productId: ProductId,
  rows: number,
  cols: number,
  options: ProductOptions = DEFAULT_OPTIONS,
  turned = false,
): LayingPlanInput {
  const product = PRODUCTS[productId];
  const base = initialDesign(productId, 7);
  const layout = computeLayout(product, rows, cols, options);
  const generated = generatePattern(base.pattern, layout);
  const cells = turned
    ? generated.map((c, i) => ({ ...c, rotation: ([0, 90, 180, 270] as const)[i % 4] }))
    : generated;
  const design = { ...base, rows, cols, options, cells };
  const schedule = computeSchedule(product, layout, cells);
  return {
    product,
    layout,
    cells,
    options,
    schedule,
    order: computeOrder(product, schedule, design.wastePct),
    design,
    lead: { firstName: 'Ada', lastName: 'Builder', email: 'ada@example.com', company: 'Studio', projectName: 'Test wall', projectSizeM2: 20 },
    dateLabel: '27 Oct 2026',
  };
}

// Set LAYING_PDF_DIR to write the sample sheets to disk (whole file + one file
// per page, so each page can be rasterised and looked at).
function maybeDump(name: string, make: () => ReturnType<typeof buildLayingPlanPdf>) {
  const dir = process.env.LAYING_PDF_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  const whole = make();
  writeFileSync(join(dir, `${name}.pdf`), Buffer.from(whole.output('arraybuffer')));
  for (let page = 1; page <= whole.getNumberOfPages(); page++) {
    const one = make();
    for (let i = one.getNumberOfPages(); i >= 1; i--) if (i !== page) one.deletePage(i);
    writeFileSync(join(dir, `${name}-p${page}.pdf`), Buffer.from(one.output('arraybuffer')));
  }
}

describe('buildLayingPlanPdf', () => {
  it('a small wall is one plan sheet plus the course list', () => {
    const input = inputFor('first-one', 8, 8);
    maybeDump('first-one-8x8', () => buildLayingPlanPdf(input));
    expect(buildLayingPlanPdf(input).getNumberOfPages()).toBe(2);
  });

  it('draws every product, including staggered and stacked Basic Third', () => {
    const cases: Array<[string, ProductId, number, number, ProductOptions?]> = [
      ['second-high-6x9', 'second-high', 6, 9],
      ['basic-third-staggered', 'basic-third', 8, 9, { ...DEFAULT_OPTIONS, bond: 'staggered' }],
      ['basic-third-stacked', 'basic-third', 8, 9, { ...DEFAULT_OPTIONS, bond: 'stacked' }],
    ];
    for (const [name, productId, rows, cols, options] of cases) {
      const input = inputFor(productId, rows, cols, options);
      maybeDump(name, () => buildLayingPlanPdf(input));
      expect(buildLayingPlanPdf(input).getNumberOfPages(), name).toBeGreaterThanOrEqual(2);
    }
  });

  it('marks turned Second High tiles', () => {
    const input = inputFor('second-high', 4, 6, DEFAULT_OPTIONS, true);
    maybeDump('second-high-turned', () => buildLayingPlanPdf(input));
    const noMarkers = inputFor('second-high', 4, 6);
    // Same wall, no turned tiles: the 'turned' note is only written when a tile is turned.
    expect(buildLayingPlanPdf(input).output().length).toBeGreaterThan(buildLayingPlanPdf(noMarkers).output().length);
  });

  it('a large wall is split over several sheets', () => {
    const small = buildLayingPlanPdf(inputFor('first-one', 8, 8));
    const largeInput = inputFor('first-one', 40, 30);
    maybeDump('first-one-40x30', () => buildLayingPlanPdf(largeInput));
    // sheets + at least one course-list page
    expect(buildLayingPlanPdf(largeInput).getNumberOfPages()).toBeGreaterThan(small.getNumberOfPages());
  });

  it('copes with a one-column wall', () => {
    for (const productId of ['first-one', 'second-high', 'basic-third'] as const) {
      expect(() => buildLayingPlanPdf(inputFor(productId, 2, 1))).not.toThrow();
    }
  });
});
