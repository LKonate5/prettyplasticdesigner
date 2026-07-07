import type { MaterialId, PatternConfig } from '../core/types';

/**
 * Curated one-click looks. Each preset sets the palette restriction + pattern
 * type + tone; the UI applies it with a fresh seed so "Shuffle" still varies
 * within the look. Add a look = add an entry here.
 */
export interface Preset {
  id: string;
  name: string;
  swatch: MaterialId[]; // a few chips to show the look on the button
  config: Partial<PatternConfig>;
}

export const PRESETS: Preset[] = [
  {
    id: 'earthy',
    name: 'Earthy mix',
    swatch: ['ochre-medium', 'terracotta-medium', 'green-medium', 'grey-medium'],
    config: {
      type: 'random',
      toneVariation: 0.4,
      allowedMaterials: [
        'ochre-light', 'ochre-medium', 'ochre-dark',
        'terracotta-light', 'terracotta-medium', 'terracotta-dark',
        'green-light', 'green-medium', 'green-dark',
        'grey-light', 'grey-medium', 'grey-dark',
      ],
    },
  },
  {
    id: 'terracotta',
    name: 'Terracotta blend',
    swatch: ['terracotta-light', 'terracotta-medium', 'terracotta-dark', 'ochre-medium'],
    config: {
      type: 'random',
      toneVariation: 0.55,
      allowedMaterials: [
        'terracotta-light', 'terracotta-medium', 'terracotta-dark', 'ochre-medium', 'ochre-dark',
      ],
    },
  },
  {
    id: 'greens',
    name: 'Greens',
    swatch: ['green-light', 'green-medium', 'green-dark'],
    config: {
      type: 'random',
      toneVariation: 0.5,
      allowedMaterials: ['green-light', 'green-medium', 'green-dark'],
    },
  },
  {
    id: 'greyscale',
    name: 'Greys only',
    swatch: ['grey-light', 'grey-medium', 'grey-dark'],
    config: {
      type: 'random',
      toneVariation: 0.45,
      allowedMaterials: ['grey-light', 'grey-medium', 'grey-dark'],
    },
  },
  {
    id: 'ochre-green',
    name: 'Ochre & green',
    swatch: ['ochre-medium', 'ochre-dark', 'green-medium', 'green-dark'],
    config: {
      type: 'random',
      toneVariation: 0.4,
      allowedMaterials: ['ochre-light', 'ochre-medium', 'ochre-dark', 'green-medium', 'green-dark'],
    },
  },
  {
    id: 'warm-gradient',
    name: 'Warm fade',
    swatch: ['ochre-light', 'ochre-dark', 'terracotta-dark'],
    config: {
      type: 'gradient',
      gradient: { direction: 'vertical' },
      toneVariation: 0.3,
      allowedMaterials: [
        'ochre-light', 'ochre-medium', 'ochre-dark', 'terracotta-medium', 'terracotta-dark',
      ],
    },
  },
];
