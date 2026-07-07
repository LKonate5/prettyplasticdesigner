import { describe, expect, it } from 'vitest';
import type { AppState } from './reducer';
import { appReducer, initialAppState } from './reducer';
import type { Action } from './actions';

const run = (state: AppState, ...actions: Action[]): AppState =>
  actions.reduce(appReducer, state);

describe('app reducer + history', () => {
  it('a 50-cell drag is ONE history entry and one undo restores everything', () => {
    let s = initialAppState(7);
    const before = s.present.cells;
    s = run(s, { type: 'STROKE_START' });
    for (let i = 0; i < 50; i++) {
      s = run(s, { type: 'PAINT_CELL', cellIndex: i, material: (i % 11) + 1 });
    }
    s = run(s, { type: 'STROKE_END' });
    expect(s.past.length).toBe(1);
    s = run(s, { type: 'UNDO' });
    expect(s.present.cells).toEqual(before);
    expect(s.future.length).toBe(1);
  });

  it('an empty stroke leaves no history entry', () => {
    let s = initialAppState(7);
    s = run(s, { type: 'STROKE_START' }, { type: 'STROKE_END' });
    expect(s.past.length).toBe(0);
    // painting the same material a cell already has is also a no-op
    const mat = s.present.cells[3].material;
    s = run(
      s,
      { type: 'STROKE_START' },
      { type: 'PAINT_CELL', cellIndex: 3, material: mat },
      { type: 'STROKE_END' },
    );
    expect(s.past.length).toBe(0);
  });

  it('redo works and is cleared by a new edit', () => {
    let s = initialAppState(7);
    s = run(
      s,
      { type: 'STROKE_START' },
      { type: 'PAINT_CELL', cellIndex: 0, material: 5 },
      { type: 'STROKE_END' },
      { type: 'UNDO' },
    );
    expect(s.future.length).toBe(1);
    s = run(s, { type: 'REDO' });
    expect(s.present.cells[0].material).toBe(5);
    s = run(
      s,
      { type: 'UNDO' },
      { type: 'STROKE_START' },
      { type: 'PAINT_CELL', cellIndex: 1, material: 4 },
      { type: 'STROKE_END' },
    );
    expect(s.future.length).toBe(0);
  });

  it('history is capped under a scripted 500-event paint session', () => {
    let s = initialAppState(7);
    for (let stroke = 0; stroke < 100; stroke++) {
      s = run(s, { type: 'STROKE_START' });
      for (let i = 0; i < 4; i++) {
        s = run(s, {
          type: 'PAINT_CELL',
          cellIndex: (stroke * 4 + i) % s.present.cells.length,
          material: (stroke + i) % 12,
        });
      }
      s = run(s, { type: 'STROKE_END' });
    }
    expect(s.past.length).toBeLessThanOrEqual(50);
  });

  it('slider runs coalesce: many exposure ticks = one undo entry, cells kept', () => {
    let s = initialAppState(7);
    s = run(s, { type: 'SET_PRODUCT', productId: 'basic-third' });
    const cellsBefore = s.present.cells;
    const pastLen = s.past.length;
    for (let e = 300; e <= 500; e += 10) {
      s = run(s, { type: 'SET_OPTIONS', options: { exposure: e } });
    }
    expect(s.present.options.exposure).toBe(500);
    expect(s.past.length).toBe(pastLen + 1);
    expect(s.present.cells).toBe(cellsBefore); // exposure never regenerates cells
    s = run(s, { type: 'UNDO' });
    expect(s.present.options.exposure).toBe(450);
  });

  it('grid changes regenerate cells to the new layout size', () => {
    let s = initialAppState(7);
    const before = s.present.cells.length;
    s = run(s, { type: 'SET_GRID', rows: s.present.rows + 4 });
    expect(s.present.cells.length).toBeGreaterThan(before);
  });

  it('the tile cap refuses oversize grids and raises the notice', () => {
    let s = initialAppState(7);
    const before = s.present;
    s = run(s, { type: 'SET_GRID', rows: 80, cols: 80 });
    expect(s.present).toBe(before);
    expect(s.ui.capNotice).toBe(true);
    s = run(s, { type: 'SET_GRID', rows: 10, cols: 10 });
    expect(s.ui.capNotice).toBe(false);
  });

  it('rotation steps wrap around 0/90/180/270', () => {
    let s = initialAppState(7);
    s = run(s, { type: 'SET_PRODUCT', productId: 'second-high' });
    s = run(
      s,
      { type: 'STROKE_START' },
      { type: 'ROTATE_CELL', cellIndex: 0, delta: -1 },
      { type: 'STROKE_END' },
    );
    const base = s.present.cells[0].rotation;
    expect([0, 90, 180, 270]).toContain(base);
  });
});
