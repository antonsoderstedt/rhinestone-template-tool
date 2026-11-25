import { readMeshFile, type RawMesh, type Vec3 } from '@/src/lib/papercraft-engine';
import type { BufferGeometry, Object3D } from 'three';

export const MODEL_FILE_ACCEPT = '.obj,.stl,.glb,.gltf';
/** Files above this are refused before reading (a model this big would freeze the page). */
export const MAX_MODEL_FILE_BYTES = 40 * 1024 * 1024;

export class ModelFileError extends Error {
  constructor(public readonly code: 'too-big' | 'unsupported' | 'unreadable' | 'no-faces', message: string) {
    super(message);
  }
}

/**
 * Collects every mesh of a loaded three.js scene into one mesh (triangles), with the world transforms applied. glTF is
 * y-up and the engine is z-up (height is z), so the model is turned upright: (x, y, z) becomes (x, -z, y).
 */
export function object3dToRawMesh(root: Object3D): RawMesh {
  root.updateMatrixWorld(true);
  const positions: Vec3[] = [];
  const faces: number[][] = [];
  root.traverse((obj) => {
    const geometry = (obj as { geometry?: BufferGeometry }).geometry;
    if (!geometry || !(obj as { isMesh?: boolean }).isMesh) return;
    const attr = geometry.getAttribute('position');
    if (!attr) return;
    const m = obj.matrixWorld.elements;
    const base = positions.length;
    for (let i = 0; i < attr.count; i++) {
      const x = attr.getX(i);
      const y = attr.getY(i);
      const z = attr.getZ(i);
      const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
      const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
      const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
      positions.push([wx, -wz, wy]);
    }
    const index = geometry.getIndex();
    const count = index ? index.count : attr.count;
    for (let i = 0; i + 2 < count; i += 3) {
      const a = index ? index.getX(i) : i;
      const b = index ? index.getX(i + 1) : i + 1;
      const c = index ? index.getX(i + 2) : i + 2;
      // The turn above is a rotation, so the winding is kept.
      faces.push([base + a, base + b, base + c]);
    }
  });
  return { positions, faces };
}

async function readGltf(data: ArrayBuffer, isText: boolean): Promise<RawMesh> {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();
  const gltf = await new Promise<{ scene: Object3D }>((resolve, reject) => {
    const input = isText ? new TextDecoder().decode(data) : data;
    loader.parse(input, '', (result) => resolve(result), (error) => reject(error));
  });
  return object3dToRawMesh(gltf.scene);
}

/** Reads a model file the user picked: OBJ, STL, GLB or a self-contained glTF. */
export async function readModelFile(file: File): Promise<{ fileName: string; mesh: RawMesh }> {
  if (file.size > MAX_MODEL_FILE_BYTES) throw new ModelFileError('too-big', 'The file is too big.');
  const name = file.name;
  const lower = name.toLowerCase();
  const buffer = await file.arrayBuffer();
  let mesh: RawMesh;
  try {
    if (lower.endsWith('.glb')) mesh = await readGltf(buffer, false);
    else if (lower.endsWith('.gltf')) mesh = await readGltf(buffer, true);
    else if (lower.endsWith('.obj') || lower.endsWith('.stl')) mesh = readMeshFile(name, new Uint8Array(buffer));
    else throw new ModelFileError('unsupported', 'Unsupported file type.');
  } catch (error) {
    if (error instanceof ModelFileError) throw error;
    throw new ModelFileError('unreadable', error instanceof Error ? error.message : 'The file could not be read.');
  }
  if (mesh.faces.length === 0) throw new ModelFileError('no-faces', 'The file has no faces.');
  return { fileName: name, mesh };
}
