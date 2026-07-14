/**
 * ALL user-facing copy lives here (English-only v1). Adding a language later
 * means swapping this object per locale — no component changes.
 */
export const STR = {
  brand: 'Pretty Plastic',
  appTitle: 'Facade Designer',

  product: 'Product',
  rows: 'Rows',
  columns: 'Columns',
  wallSize: 'Wall size',
  widthM: 'Width (m)',
  heightM: 'Height (m)',
  advancedGrid: 'Set by rows & columns instead',
  renderedPreviewNote:
    'Note: this product is shown as a rendered preview — these are generated images, not photos of the actual tiles. The real tiles follow the same colours and format.',
  borrowedPhotoNote:
    'Note: Basic Third does not yet have its own tile photos, so this preview borrows First One photography in matching colours and shades — both are made from the same recycled material. The real Basic Third tiles will show their own three-band relief pattern.',
  bond: 'Bond',
  stacked: 'Stacked',
  staggered: 'Staggered',

  pattern: 'Pattern',
  patternSolid: 'Solid',
  patternRandom: 'Random mix',
  patternGradient: 'Gradient',
  patternStripes: 'Stripes',
  patternChecker: 'Checker',
  direction: 'Direction',
  horizontal: 'Horizontal',
  vertical: 'Vertical',
  diagonal: 'Diagonal',
  stripeWidth: 'Stripe width (tiles)',
  toneVariation: 'Tone variation',
  preset: 'Quick looks',
  variation: 'Variation',
  variationHint: 'Note this code to come back to a look you like, or type one in.',
  reroll: 'Shuffle',
  randomRotation: 'Mix tile rotations',
  baseColour: 'Base colour',

  palette: 'Colours & shades',
  paintingWith: 'Painting with',
  shadeLight: 'Light',
  shadeMedium: 'Medium',
  shadeDark: 'Dark',
  colourOchre: 'Ochre',
  colourTerracotta: 'Terracotta',
  colourGreen: 'Green',
  colourGrey: 'Grey',
  paletteHint:
    'Click a colour to paint with it. The dot in the corner includes or excludes it from the auto-generated mix.',
  allowAll: 'Use all',

  tools: 'Tools',
  paint: 'Paint',
  rotate: 'Rotate',
  rotateHint: 'Click a tile to turn it 90°. Hold Shift to turn it back.',
  undo: 'Undo',
  redo: 'Redo',
  reset: 'Reset',
  undoHint: 'Step back your last change (paint, pattern, size…). Also ⌘/Ctrl+Z.',
  redoHint: 'Re-apply a change you just undid. Also ⇧⌘/Ctrl+Z.',
  resetHint: 'Clear everything and start over with a fresh random design.',
  toolsHint: 'Undo / Redo step through your changes; Reset starts a brand-new design.',
  facadeRotation: 'Facade orientation',
  facadeRotationHint:
    'Sets every tile to face the same way (0° = raised corner faces north). Click a row or column margin next to the wall to turn just that row or column.',

  schedule: 'Tile schedule',
  material: 'Material',
  count: 'Tiles',
  weightKg: 'kg',
  total: 'Total',
  wall: 'Wall',
  area: 'Area',
  squareMetres: 'Square metres',
  tilesPerM2: 'tiles/m²',
  scheduleNote: 'Counts include cut edge tiles and exclude site waste — verify before ordering.',
  fullSqmNote:
    '* Pretty Plastic produces full square metres only — any part-metre rounds up to the next whole m².',

  order: 'Order & quantities',
  waste: 'Waste allowance',
  onWall: 'On wall',
  toOrder: 'To order',
  pallets: 'Pallets',
  weight: 'Weight',
  palletNote: (m2: number) =>
    `Pretty Plastic ships in full square metres on europallets (${m2} m² per pallet). Quantities are rounded up.`,

  requestSample: 'Request a sample',
  requestQuote: 'Request a quote',
  requestHint: 'Opens a pre-filled email to Pretty Plastic. The quote also downloads your wall image to attach.',
  quoteImageNote: 'Wall image downloaded — please attach it to this email.',

  capNotice: 'That size would exceed 5,000 tiles — reduce rows or columns.',
  regenNote:
    'Size and pattern changes regenerate the design. Hand-painted tiles may be replaced — Undo brings them back.',

  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  zoomFit: 'Fit wall to view',
  menu: 'Design',
  seeWall: 'See wall',
  export: 'Export',

  share: 'Share design',
  copyLink: 'Copy link',
  copied: 'Link copied',
  shareHint: 'Copies a link that reopens this exact design.',
};
