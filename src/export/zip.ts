/**
 * Minimal store-only (no compression) ZIP writer — enough to bundle the OBJ
 * and its MTL into one download without pulling in a zip dependency.
 * Implements the classic PKZIP local-file + central-directory layout.
 */

interface Entry {
  name: string;
  data: Uint8Array;
  crc: number;
  offset: number;
}

export function makeZip(files: { name: string; text: string }[]): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const entries: Entry[] = [];
  let offset = 0;

  for (const file of files) {
    const data = enc.encode(file.text);
    const nameBytes = enc.encode(file.name);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true); // local file header signature
    dv.setUint16(4, 20, true); // version needed
    dv.setUint16(6, 0, true); // flags
    dv.setUint16(8, 0, true); // method 0 = store
    dv.setUint16(10, 0, true); // mod time
    dv.setUint16(12, 0, true); // mod date
    dv.setUint32(14, crc, true);
    dv.setUint32(18, data.length, true); // compressed size
    dv.setUint32(22, data.length, true); // uncompressed size
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true); // extra length
    local.set(nameBytes, 30);

    entries.push({ name: file.name, data, crc, offset });
    chunks.push(local, data);
    offset += local.length + data.length;
  }

  // central directory
  const central: Uint8Array[] = [];
  let centralSize = 0;
  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const rec = new Uint8Array(46 + nameBytes.length);
    const dv = new DataView(rec.buffer);
    dv.setUint32(0, 0x02014b50, true); // central dir signature
    dv.setUint16(4, 20, true); // version made by
    dv.setUint16(6, 20, true); // version needed
    dv.setUint16(8, 0, true);
    dv.setUint16(10, 0, true); // method store
    dv.setUint16(12, 0, true);
    dv.setUint16(14, 0, true);
    dv.setUint32(16, e.crc, true);
    dv.setUint32(20, e.data.length, true);
    dv.setUint32(24, e.data.length, true);
    dv.setUint16(28, nameBytes.length, true);
    dv.setUint16(30, 0, true); // extra
    dv.setUint16(32, 0, true); // comment
    dv.setUint16(34, 0, true); // disk
    dv.setUint16(36, 0, true); // internal attrs
    dv.setUint32(38, 0, true); // external attrs
    dv.setUint32(42, e.offset, true);
    rec.set(nameBytes, 46);
    central.push(rec);
    centralSize += rec.length;
  }

  const end = new Uint8Array(22);
  const dv = new DataView(end.buffer);
  dv.setUint32(0, 0x06054b50, true); // end of central dir signature
  dv.setUint16(8, entries.length, true);
  dv.setUint16(10, entries.length, true);
  dv.setUint32(12, centralSize, true);
  dv.setUint32(16, offset, true); // central dir offset
  dv.setUint16(20, 0, true); // comment length

  return new Blob([...chunks, ...central, end], { type: 'application/zip' });
}

// CRC-32 (IEEE), table built once.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
