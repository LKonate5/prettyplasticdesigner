import { describe, expect, it } from 'vitest';
import { COUNTRIES } from './countries';

describe('country picker data', () => {
  it('includes searchable flag labels for common countries', () => {
    expect(COUNTRIES.length).toBeGreaterThan(200);
    expect(COUNTRIES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'BE', label: expect.stringContaining('Belgium') }),
        expect.objectContaining({ code: 'DE', label: expect.stringContaining('Germany') }),
        expect.objectContaining({ code: 'US', label: expect.stringContaining('United States') }),
      ]),
    );
  });
});
