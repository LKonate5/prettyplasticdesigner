import type { ProductId, ProductOptions, ProductSpec } from '../core/types';

/**
 * Real product specs from prettyplastic.nl/products (verified 2026-07-02).
 * Adding a product = add an entry here + a layout module in core/layout/.
 */
export const PRODUCTS: Record<ProductId, ProductSpec> = {
  'first-one': {
    id: 'first-one',
    name: 'First One',
    tile: { w: 304, h: 400, d: 29 },
    weightKg: 1.1,
    nominalTilesPerM2: 22.2,
    palletM2: 40,
    supportsRotation: false,
    hasExposure: false,
    hasBond: false,
    maxTiles: 5000,
  },
  'second-high': {
    id: 'second-high',
    name: 'Second High',
    tile: { w: 294, h: 294, d: 67 },
    weightKg: 1.2,
    nominalTilesPerM2: 11.1,
    palletM2: 30,
    supportsRotation: true,
    hasExposure: false,
    hasBond: false,
    maxTiles: 5000,
  },
  'basic-third': {
    id: 'basic-third',
    name: 'Basic Third',
    tile: { w: 329, h: 569, d: 30 },
    weightKg: 2.5,
    nominalTilesPerM2: 6.7,
    palletM2: 60,
    supportsRotation: false,
    hasExposure: true,
    hasBond: true,
    maxTiles: 5000,
  },
};

export const PRODUCT_LIST: readonly ProductSpec[] = Object.values(PRODUCTS);

export const DEFAULT_OPTIONS: ProductOptions = {
  exposure: 450, // mm — matches the published ~6.7 tiles/m² figure
  bond: 'staggered',
};

export const EXPOSURE_MIN = 300;
export const EXPOSURE_MAX = 500;
