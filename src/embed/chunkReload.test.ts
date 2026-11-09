import { describe, expect, it } from 'vitest';
import { isChunkLoadError } from './chunkReload';

describe('isChunkLoadError', () => {
  it('matches the common Vite / browser messages', () => {
    expect(
      isChunkLoadError(
        new Error(
          'Failed to fetch dynamically imported module: https://design.prettyplastic.nl/assets/raster-CY4uChll.js',
        ),
      ),
    ).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true);
    expect(isChunkLoadError({ name: 'ChunkLoadError', message: 'Loading chunk 5 failed.' })).toBe(
      true,
    );
  });

  it('ignores ordinary export failures', () => {
    expect(isChunkLoadError(new Error('SVG rasterization failed'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError('boom')).toBe(false);
  });
});
