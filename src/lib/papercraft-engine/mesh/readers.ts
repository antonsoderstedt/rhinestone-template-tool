import type { RawMesh, Vec3 } from '../types';

export class MeshReadError extends Error {}

/** Wavefront OBJ: vertices (`v`) and faces (`f`, with or without texture/normal indices, negative indices allowed). */
export function parseObj(text: string): RawMesh {
  const positions: Vec3[] = [];
  const faces: number[][] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line[0] === '#') continue;
    const parts = line.split(/\s+/);
    if (parts[0] === 'v') {
      const x = Number(parts[1]);
      const y = Number(parts[2]);
      const z = Number(parts[3]);
      if (![x, y, z].every(Number.isFinite)) throw new MeshReadError(`Bad vertex in OBJ file: "${line.slice(0, 60)}"`);
      positions.push([x, y, z]);
    } else if (parts[0] === 'f') {
      const ids = parts.slice(1).map((token) => {
        const n = parseInt(token.split('/')[0], 10);
        if (!Number.isFinite(n) || n === 0) throw new MeshReadError(`Bad face in OBJ file: "${line.slice(0, 60)}"`);
        return n > 0 ? n - 1 : positions.length + n;
      });
      if (ids.length >= 3) faces.push(ids);
    }
  }
  if (positions.length === 0 || faces.length === 0) throw new MeshReadError('The OBJ file has no vertices or faces.');
  return { positions, faces };
}

function parseAsciiStl(text: string): RawMesh {
  const positions: Vec3[] = [];
  const faces: number[][] = [];
  let current: number[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (t.startsWith('vertex')) {
      const [, x, y, z] = t.split(/\s+/);
      const v: Vec3 = [Number(x), Number(y), Number(z)];
      if (!v.every(Number.isFinite)) throw new MeshReadError('Bad vertex in STL file.');
      current.push(positions.length);
      positions.push(v);
    } else if (t.startsWith('endfacet')) {
      if (current.length === 3) faces.push(current);
      current = [];
    }
  }
  if (faces.length === 0) throw new MeshReadError('The STL file has no triangles.');
  return { positions, faces };
}

/** STL, ASCII or binary (decided by the size the binary header promises). Vertices are not shared: weld them in `buildSolid`. */
export function parseStl(data: Uint8Array): RawMesh {
  if (data.byteLength >= 84) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const triangles = view.getUint32(80, true);
    if (84 + triangles * 50 === data.byteLength) {
      const positions: Vec3[] = [];
      const faces: number[][] = [];
      let o = 84;
      for (let t = 0; t < triangles; t++) {
        o += 12; // normal
        const face: number[] = [];
        for (let v = 0; v < 3; v++) {
          const p: Vec3 = [view.getFloat32(o, true), view.getFloat32(o + 4, true), view.getFloat32(o + 8, true)];
          o += 12;
          if (!p.every(Number.isFinite)) throw new MeshReadError('Bad vertex in STL file.');
          face.push(positions.length);
          positions.push(p);
        }
        o += 2; // attribute bytes
        faces.push(face);
      }
      if (faces.length === 0) throw new MeshReadError('The STL file has no triangles.');
      return { positions, faces };
    }
  }
  const text = new TextDecoder().decode(data);
  if (!/^\s*solid/i.test(text) || !/facet/i.test(text)) throw new MeshReadError('This does not look like an STL file.');
  return parseAsciiStl(text);
}

/** Read a model file by its name's extension. GLB/GLTF are read in the app (three.js) and handed over as a RawMesh. */
export function readMeshFile(name: string, data: Uint8Array): RawMesh {
  const lower = name.toLowerCase();
  if (lower.endsWith('.obj')) return parseObj(new TextDecoder().decode(data));
  if (lower.endsWith('.stl')) return parseStl(data);
  throw new MeshReadError('Unsupported file type. Use OBJ or STL (GLB is read in the app).');
}
