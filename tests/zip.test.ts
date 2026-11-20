import { describe, expect, it } from 'vitest';
import { crc32, createZip } from '../app/lib/zip';

/** A tiny reader, written independently of the writer, to check the archive structure. */
function readZip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.length - 22;
  expect(view.getUint32(eocd, true)).toBe(0x06054b50);
  const count = view.getUint16(eocd + 10, true);
  let cd = view.getUint32(eocd + 16, true);
  const files: Array<{ name: string; text: string; crc: number; crcOk: boolean }> = [];
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(cd, true)).toBe(0x02014b50);
    const crc = view.getUint32(cd + 16, true);
    const size = view.getUint32(cd + 24, true);
    const nameLen = view.getUint16(cd + 28, true);
    const extraLen = view.getUint16(cd + 30, true);
    const commentLen = view.getUint16(cd + 32, true);
    const localOffset = view.getUint32(cd + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(cd + 46, cd + 46 + nameLen));
    expect(view.getUint32(localOffset, true)).toBe(0x04034b50);
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtra = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLen + localExtra;
    const data = bytes.subarray(start, start + size);
    files.push({ name, text: new TextDecoder().decode(data), crc, crcOk: crc32(data) === crc });
    cd += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

describe('createZip', () => {
  it('has the standard CRC-32 of a known string', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it('stores every file, in order, with matching checksums', () => {
    const files = [
      { name: 'design-part-1-of-2.svg', data: '<svg>one</svg>' },
      { name: 'design-part-2-of-2.svg', data: '<svg>two</svg>' },
      { name: 'parts.txt', data: 'Part 1 and 2' },
    ];
    const read = readZip(createZip(files));
    expect(read.map((f) => f.name)).toEqual(files.map((f) => f.name));
    expect(read.map((f) => f.text)).toEqual(files.map((f) => f.data));
    expect(read.every((f) => f.crcOk)).toBe(true);
  });

  it('keeps non-ASCII names and bytes intact', () => {
    const read = readZip(createZip([{ name: 'Sulay Å Ä Ö.svg', data: new Uint8Array([0, 1, 2, 255]) }]));
    expect(read[0]!.name).toBe('Sulay Å Ä Ö.svg');
    expect(read[0]!.crcOk).toBe(true);
  });

  it('is reproducible for the same input and timestamp, and handles no files', () => {
    const files = [{ name: 'a.txt', data: 'a' }];
    expect(createZip(files)).toEqual(createZip(files));
    expect(readZip(createZip([]))).toEqual([]);
  });
});
