'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { buildFoldTree, faceTriangles, foldPoses, type PapercraftResult, type Vec3 } from '@/src/lib/papercraft-engine';
import { isWebglAvailable } from '../htv/webglSupport';
import { useT } from '../lib/i18n';
import { partColor } from './papercraftColors';

interface Model3DProps {
  run: PapercraftResult;
  /** 1 is folded, 0 is each part laid flat. */
  fold: number;
  selectedPartId: number | null;
  onSelectPart: (partId: number | null) => void;
}

interface FaceData {
  faceId: number;
  partId: number;
  geometry: THREE.BufferGeometry;
  /** Edges that are cut (red) and edges that are folded (grey). */
  cutLines: THREE.BufferGeometry;
  foldLines: THREE.BufferGeometry;
}

function lineGeometry(points: Vec3[], pairs: [number, number][]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const arr: number[] = [];
  for (const [a, b] of pairs) arr.push(...points[a], ...points[b]);
  g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  return g;
}

function Scene({ run, fold, selectedPartId, onSelectPart }: Model3DProps) {
  const invalidate = useThree((s) => s.invalidate);
  const groups = useRef<(THREE.Group | null)[]>([]);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  const model = useMemo(() => {
    const solid = run.solid;
    const partOfFace = new Array<number>(solid.faces.length).fill(0);
    const partFaces = run.pattern.parts.map((p) => {
      for (const f of p.faces) partOfFace[f.faceId] = p.id;
      return p.faces.map((f) => f.faceId);
    });
    const tree = buildFoldTree(solid, run.pattern.joinedEdgeIds, partFaces);
    const joined = new Set(run.pattern.joinedEdgeIds);

    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const v of solid.vertices) for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], v[i]); max[i] = Math.max(max[i], v[i]); }
    const centre = new THREE.Vector3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    const radius = Math.max(1, Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2);

    const faces: FaceData[] = solid.faces.map((face) => {
      const g = new THREE.BufferGeometry();
      const pos: number[] = [];
      for (const [a, b, c] of faceTriangles(solid, face.id)) pos.push(...solid.vertices[a], ...solid.vertices[b], ...solid.vertices[c]);
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      const cut: [number, number][] = [];
      const foldE: [number, number][] = [];
      face.vertices.forEach((v, k) => {
        const w = face.vertices[(k + 1) % face.vertices.length];
        (joined.has(face.edgeIds[k]) ? foldE : cut).push([v, w]);
      });
      return { faceId: face.id, partId: partOfFace[face.id], geometry: g, cutLines: lineGeometry(solid.vertices as Vec3[], cut), foldLines: lineGeometry(solid.vertices as Vec3[], foldE) };
    });

    // Where each part moves when the model is spread out (away from the middle of the model).
    const centroid = (faceId: number) => {
      const vs = solid.faces[faceId].vertices.map((v) => solid.vertices[v]);
      return new THREE.Vector3(vs.reduce((s, v) => s + v[0], 0) / vs.length, vs.reduce((s, v) => s + v[1], 0) / vs.length, vs.reduce((s, v) => s + v[2], 0) / vs.length);
    };
    const explode = partFaces.map((ids) => {
      const dir = centroid(Math.min(...ids)).sub(centre);
      return dir.lengthSq() < 1e-9 ? new THREE.Vector3(0, 0, 1) : dir.normalize();
    });
    const flatRadius = radius * 1.1 + 0.7 * Math.max(...run.pattern.parts.map((p) => Math.hypot(p.widthMm, p.heightMm)));
    return { solid, tree, faces, centre, radius, flatRadius, explode, partIndexOf: new Map(run.pattern.parts.map((p, i) => [p.id, i])) };
  }, [run]);

  useEffect(() => () => model.faces.forEach((f) => { f.geometry.dispose(); f.cutLines.dispose(); f.foldLines.dispose(); }), [model]);

  // Move every face to its pose for the fold amount.
  useEffect(() => {
    const poses = foldPoses(model.tree, fold);
    const spread = (1 - fold) * model.radius * 1.1;
    model.faces.forEach((f) => {
      const g = groups.current[f.faceId];
      if (!g) return;
      const m = poses[f.faceId].slice();
      const off = model.explode[model.partIndexOf.get(f.partId) ?? 0];
      m[12] += off.x * spread;
      m[13] += off.y * spread;
      m[14] += off.z * spread;
      g.matrix.fromArray(m);
      g.matrixWorldNeedsUpdate = true;
    });
    invalidate();
  }, [model, fold, invalidate]);

  useEffect(() => invalidate(), [selectedPartId, invalidate]);

  const distance = model.radius * 4.4;
  // The flat net is much bigger than the folded model: the camera backs away along its line of sight as the model unfolds.
  const flatDistance = Math.max(distance, model.flatRadius * 2.6);
  useEffect(() => {
    cameraRef.current?.position.setLength(distance + (flatDistance - distance) * (1 - fold));
    invalidate();
  }, [fold, distance, flatDistance, invalidate]);

  // A camera made here does not look at the model by itself.
  useEffect(() => {
    cameraRef.current?.lookAt(0, 0, 0);
    invalidate();
  }, [distance, invalidate]);

  return (
    <>
      <PerspectiveCamera
        ref={cameraRef}
        makeDefault
        fov={40}
        near={model.radius / 50}
        far={model.radius * 60}
        position={[distance * 0.7, distance * 0.55, distance * 0.8]}
      />
      <ambientLight intensity={0.75} />
      <directionalLight position={[model.radius * 2, model.radius * 3, model.radius * 2]} intensity={1.6} />
      <directionalLight position={[-model.radius * 2, -model.radius, -model.radius * 2]} intensity={0.5} />
      {/* The model is z-up; three.js is y-up. */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <group position={[-model.centre.x, -model.centre.y, -model.centre.z]}>
          {model.faces.map((f) => {
            const selected = selectedPartId === f.partId;
            return (
              <group
                key={f.faceId}
                ref={(g) => {
                  groups.current[f.faceId] = g;
                  if (g) g.matrixAutoUpdate = false;
                }}
              >
                <mesh
                  geometry={f.geometry}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPart(f.partId);
                  }}
                >
                  <meshStandardMaterial color={partColor(f.partId, selected ? 72 : 58)} emissive={selected ? '#553300' : '#000000'} side={THREE.DoubleSide} flatShading polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
                </mesh>
                <lineSegments geometry={f.foldLines}>
                  <lineBasicMaterial color="#444444" />
                </lineSegments>
                <lineSegments geometry={f.cutLines}>
                  <lineBasicMaterial color="#d12020" />
                </lineSegments>
              </group>
            );
          })}
        </group>
      </group>
      <OrbitControls makeDefault enableDamping={false} />
    </>
  );
}

export default function Model3D(props: Model3DProps) {
  const t = useT();
  const webgl = useMemo(() => (typeof document === 'undefined' ? true : isWebglAvailable()), []);
  if (!webgl) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-[var(--studio-ink-secondary)]">
        {t('This browser cannot show 3D here. The pattern and the pages work as usual.')}
      </div>
    );
  }
  return (
    <div className="h-full w-full" aria-label={t('3D model. Drag to turn it, scroll to zoom.')} role="img">
      <Canvas frameloop="demand" onPointerMissed={() => props.onSelectPart(null)} dpr={[1, 2]}>
        <Scene {...props} />
      </Canvas>
    </div>
  );
}
