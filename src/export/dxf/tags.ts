/**
 * Low-level DXF writer helpers. A DXF file is a flat list of (group code,
 * value) pairs, each on its own line. AC1015 (AutoCAD 2000) requires a unique
 * hex handle on every entity and table record, so we hand out handles from a
 * single counter.
 */
export class DxfBuilder {
  private lines: string[] = [];
  private handle = 0x100; // 0x1..0xFF are reserved-ish; start clear of them

  /** One group-code / value pair. */
  tag(code: number, value: string | number): this {
    this.lines.push(String(code));
    this.lines.push(typeof value === 'number' ? fmtNum(value) : value);
    return this;
  }

  /** Allocate the next unique handle (hex, uppercase, no 0x). */
  nextHandle(): string {
    return (this.handle++).toString(16).toUpperCase();
  }

  /** Peek the seed value for $HANDSEED (must be > every handle used). */
  handleSeed(): string {
    return this.handle.toString(16).toUpperCase();
  }

  section(name: string): this {
    return this.tag(0, 'SECTION').tag(2, name);
  }

  endSection(): this {
    return this.tag(0, 'ENDSEC');
  }

  toString(): string {
    return this.lines.join('\r\n') + '\r\n';
  }
}

/** DXF wants a plain decimal, never exponent notation; trim trailing zeros. */
export function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const s = n.toFixed(6);
  return s.replace(/\.?0+$/, '') || '0';
}
