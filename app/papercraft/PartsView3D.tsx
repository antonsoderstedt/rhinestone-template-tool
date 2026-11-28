'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { PART_FACES, partAxes, partFaceCentre, partMesh, resizeBuildPart, rotateBuildPart, rotationAxes, type BuildPart, type PartFace } from '@/src/lib/papercraft-engine';
import { isWebglAvailable } from '../htv/webglSupport';
import { useT } from '../lib/i18n';
import { partColor } from './papercraftColors';
import { angleAround, angleDifference, axisParameter, dragDelta, dragPlane, modelToScene, rayPlaneHit, type DragMode, type DragPlane, type V3 } from './partsDrag';

/** Sizes are rounded to a whole millimetre when a handle is dragged, as a part is when it is moved. */
const GRID_MM = 1;
/** A turn is rounded to whole steps of this many degrees when a turn ring is dragged. */
const TURN_GRID_DEG = 5;
const RING_COLOURS = { x: '#ef4444', y: '#22c55e', z: '#3b82f6' } as const;

interface Delta {
  dx: number;
  dy: number;
  dz: number;
}

interface Props {
  parts: BuildPart[];
  selected: number | null;
  onSelect: (index: number | null) => void;
  /** The part was dragged by this much (millimetres, in the model). */
  onMove: (index: number, delta: Delta) => void;
  /** A face of the part was dragged outward by this much (millimetres; negative is inward). */
  onResize: (index: number, face: PartFace, delta: number) => void;
  /** The part was turned by this many degrees about its x, y or z turn (the new angle is rounded to a few degrees). */
  onRotate: (index: number, axis: 'x' | 'y' | 'z', degrees: number) => void;
}

interface Built {
  geometry: THREE.BufferGeometry;
  edges: THREE.BufferGeometry;
}

/** A part as triangles (its faces are flat and convex, so a fan is right) and as outline segments. */
function buildGeometry(part: BuildPart): Built {
  const mesh = partMesh(part);
  const tri: number[] = [];
  const lines: number[] = [];
  for (const face of mesh.faces) {
    for (let k = 1; k + 1 < face.length; k++) tri.push(...mesh.positions[face[0]!]!, ...mesh.positions[face[k]!]!, ...mesh.positions[face[k + 1]!]!);
    face.forEach((v, k) => lines.push(...mesh.positions[v]!, ...mesh.positions[face[(k + 1) % face.length]!]!));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
  geometry.computeVertexNormals();
  const edges = new THREE.BufferGeometry();
  edges.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  return { geometry, edges };
}

function boundsRadius(parts: readonly BuildPart[]): { centre: V3; radius: number } {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) for (const v of partMesh(p).positions) for (let k = 0; k < 3; k++) {
    lo[k] = Math.min(lo[k]!, v[k]!);
    hi[k] = Math.max(hi[k]!, v[k]!);
  }
  if (lo[0]! > hi[0]!) return { centre: [0, 0, 0], radius: 50 };
  return { centre: [(lo[0]! + hi[0]!) / 2, (lo[1]! + hi[1]!) / 2, (lo[2]! + hi[2]!) / 2], radius: Math.max(20, Math.hypot(hi[0]! - lo[0]!, hi[1]! - lo[1]!, hi[2]! - lo[2]!) / 2) };
}

function Scene({ parts, selected, onSelect, onMove, onResize, onRotate }: Props) {
  const invalidate = useThree((s) => s.invalidate);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);
  /** The turn-the-view controls are switched off while a part is dragged, so the same drag does not turn the view. */
  const orbit = useCallback((on: boolean) => {
    const c = get().controls as { enabled: boolean } | null;
    if (c) c.enabled = on;
  }, [get]);
  const [preview, setPreview] = useState<({ index: number } & Delta) | null>(null);
  const [turning, setTurning] = useState<{ index: number; axis: 'x' | 'y' | 'z'; deg: number } | null>(null);
  const [resizing, setResizing] = useState<{ index: number; face: PartFace; delta: number } | null>(null);
  const drag = useRef<{ index: number; mode: DragMode; plane: DragPlane; start: V3 } | null>(null);
  // The view starts where the model is; it is not moved when a part is.
  const [initial] = useState(() => boundsRadius(parts));

  // While a handle is dragged the part is shown at its new size (the model itself changes when the drag ends).
  const shown = useMemo(() => (resizing ? resizeBuildPart(parts, resizing.index, resizing.face, resizing.delta, GRID_MM) : turning ? rotateBuildPart(parts, turning.index, turning.axis, turning.deg, TURN_GRID_DEG) : parts), [parts, resizing, turning]);
  const built = useMemo(() => shown.map(buildGeometry), [shown]);
  useEffect(() => () => built.forEach((b) => { b.geometry.dispose(); b.edges.dispose(); }), [built]);
  useEffect(() => invalidate(), [built, selected, preview, resizing, turning, invalidate]);

  const finish = useCallback(() => {
    drag.current = null;
    orbit(true);
    setPreview(null);
  }, [orbit]);

  const begin = (event: ThreeEvent<PointerEvent>, index: number) => {
    event.stopPropagation();
    onSelect(index);
    const part = parts[index]!;
    const mode: DragMode = event.shiftKey ? 'lift' : 'ground';
    const direction = camera.getWorldDirection(new THREE.Vector3());
    const plane = dragPlane(mode, [part.x, part.y, part.z], [direction.x, direction.y, direction.z]);
    if (!plane) return;
    const o = event.ray.origin;
    const d = event.ray.direction;
    const start = rayPlaneHit([o.x, o.y, o.z], [d.x, d.y, d.z], plane);
    if (!start) return;
    drag.current = { index, mode, plane, start };
    orbit(false);

    const raycaster = new THREE.Raycaster();
    const move = (e: PointerEvent) => {
      const g = drag.current;
      if (!g) return;
      const rect = gl.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
      const r = raycaster.ray;
      const hit = rayPlaneHit([r.origin.x, r.origin.y, r.origin.z], [r.direction.x, r.direction.y, r.direction.z], g.plane);
      if (hit) setPreview({ index: g.index, ...dragDelta(g.mode, g.start, hit) });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setPreview((p) => {
        // A click that did not move is only a selection.
        if (p && Math.hypot(p.dx, p.dy, p.dz) >= 0.5) onMove(p.index, { dx: p.dx, dy: p.dy, dz: p.dz });
        return null;
      });
      finish();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  /** Dragging a handle on a face of the selected part: the face follows the pointer along its own axis. */
  const beginResize = (event: ThreeEvent<PointerEvent>, index: number, face: PartFace) => {
    event.stopPropagation();
    const part = parts[index]!;
    const axes = partAxes(part);
    const outward = face[0] === 'x' ? axes.x : face[0] === 'y' ? axes.y : axes.z;
    const sign = face[1] === '+' ? 1 : -1;
    const direction = modelToScene([outward[0] * sign, outward[1] * sign, outward[2] * sign]);
    const point = modelToScene(partFaceCentre(part, face));
    const o = event.ray.origin;
    const d = event.ray.direction;
    const start = axisParameter([o.x, o.y, o.z], [d.x, d.y, d.z], point, direction);
    if (start === null) return;
    orbit(false);

    const raycaster = new THREE.Raycaster();
    const move = (e: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
      const r = raycaster.ray;
      const now = axisParameter([r.origin.x, r.origin.y, r.origin.z], [r.direction.x, r.direction.y, r.direction.z], point, direction);
      if (now !== null) setResizing({ index, face, delta: now - start });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setResizing((r) => {
        // A click that did not move is nothing.
        if (r && Math.abs(r.delta) >= 0.5) onResize(r.index, r.face, r.delta);
        return null;
      });
      orbit(true);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  /** Dragging a turn ring of the selected part: the part turns about that axis by how far the pointer has gone round it. */
  const beginTurn = (event: ThreeEvent<PointerEvent>, index: number, axis: 'x' | 'y' | 'z') => {
    event.stopPropagation();
    const part = parts[index]!;
    const top = partFaceCentre(part, 'z+');
    const bottom = partFaceCentre(part, 'z-');
    const centre = modelToScene([(top[0] + bottom[0]) / 2, (top[1] + bottom[1]) / 2, (top[2] + bottom[2]) / 2]);
    const about = rotationAxes(part)[axis];
    const normal = modelToScene(about);
    const plane: DragPlane = { point: centre, normal };
    const o = event.ray.origin;
    const d = event.ray.direction;
    const first = rayPlaneHit([o.x, o.y, o.z], [d.x, d.y, d.z], plane);
    if (!first) return;
    const start = angleAround(first, centre, normal);
    orbit(false);

    const raycaster = new THREE.Raycaster();
    const move = (e: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
      const r = raycaster.ray;
      const hit = rayPlaneHit([r.origin.x, r.origin.y, r.origin.z], [r.direction.x, r.direction.y, r.direction.z], plane);
      if (hit) setTurning({ index, axis, deg: angleDifference(angleAround(hit, centre, normal), start) });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setTurning((t) => {
        // A click that did not go round is nothing.
        if (t && Math.abs(t.deg) >= 2) onRotate(t.index, t.axis, t.deg);
        return null;
      });
      orbit(true);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const distance = initial.radius * 4.6;
  const handleSize = Math.max(3, initial.radius * 0.06);
  const gridSize = Math.ceil((initial.radius * 8) / 100) * 100;
  return (
    <>
      <PerspectiveCamera makeDefault fov={40} near={initial.radius / 50} far={initial.radius * 80} position={[distance * 0.7, distance * 0.6, distance * 0.8]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[initial.radius * 2, initial.radius * 3, initial.radius * 2]} intensity={1.6} />
      <directionalLight position={[-initial.radius * 2, -initial.radius, -initial.radius * 2]} intensity={0.5} />
      <gridHelper args={[gridSize, gridSize / 10, '#7c3aed', '#8884']} />
      {/* The model is z-up; three.js is y-up. */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
        {built.map((b, i) => {
          const isSelected = selected === i;
          const offset = preview && preview.index === i ? preview : { dx: 0, dy: 0, dz: 0 };
          return (
            <group key={i} position={[offset.dx, offset.dy, offset.dz]}>
              <mesh geometry={b.geometry} onPointerDown={(e) => begin(e, i)} onClick={(e) => e.stopPropagation()}>
                <meshStandardMaterial color={partColor(i + 1, isSelected ? 74 : 60)} emissive={isSelected ? '#553300' : '#000000'} side={THREE.DoubleSide} flatShading polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
              </mesh>
              <lineSegments geometry={b.edges}>
                <lineBasicMaterial color={isSelected ? '#7c3aed' : '#333333'} />
              </lineSegments>
              {isSelected && (['x', 'y', 'z'] as const).map((axis) => {
                const part = shown[i]!;
                const top = partFaceCentre(part, 'z+');
                const bottom = partFaceCentre(part, 'z-');
                const radius = Math.hypot(part.width, part.depth, part.height) * 0.62 + handleSize;
                const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...rotationAxes(part)[axis]).normalize());
                const position: [number, number, number] = [(top[0] + bottom[0]) / 2, (top[1] + bottom[1]) / 2, (top[2] + bottom[2]) / 2];
                const active = turning?.index === i && turning.axis === axis;
                return (
                  <group key={`ring-${axis}`} position={position} quaternion={q}>
                    {/* A thin ring to see, and a thicker, invisible one to grab. */}
                    <mesh raycast={() => null}>
                      <torusGeometry args={[radius, Math.max(0.4, handleSize * 0.12), 6, 64]} />
                      <meshBasicMaterial color={active ? '#f59e0b' : RING_COLOURS[axis]} depthTest={false} transparent opacity={active ? 1 : 0.8} />
                    </mesh>
                    <mesh onPointerDown={(e) => beginTurn(e, i, axis)} onClick={(e) => e.stopPropagation()}>
                      <torusGeometry args={[radius, Math.max(1.5, handleSize * 0.45), 6, 64]} />
                      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                    </mesh>
                  </group>
                );
              })}
              {isSelected && PART_FACES.map((face) => (
                <mesh key={face} position={partFaceCentre(shown[i]!, face)} onPointerDown={(e) => beginResize(e, i, face)} onClick={(e) => e.stopPropagation()}>
                  <boxGeometry args={[handleSize, handleSize, handleSize]} />
                  <meshBasicMaterial color={resizing?.index === i && resizing.face === face ? '#f59e0b' : '#ffffff'} depthTest={false} transparent opacity={0.95} />
                </mesh>
              ))}
            </group>
          );
        })}
      </group>
      <OrbitControls makeDefault enableDamping={false} />
    </>
  );
}

/**
 * The parts of a model built from parts, in 3D: click one to select it, drag it to move it on the ground, hold Shift and drag to lift it. The selected
 * part has a square handle in the middle of each of its faces: drag one to make the part wider, deeper or taller (the opposite face stays where it is).
 */
export default function PartsView3D(props: Props) {
  const t = useT();
  const webgl = useMemo(() => (typeof document === 'undefined' ? true : isWebglAvailable()), []);
  if (!webgl) {
    return <div className="flex h-full items-center justify-center p-6 text-center text-sm text-[var(--studio-ink-secondary)]">{t('This browser cannot show 3D here. The pattern and the pages work as usual.')}</div>;
  }
  return (
    <div className="relative h-full w-full" aria-label={t('The parts in 3D. Drag a part to move it, hold Shift to lift it, drag a square handle on the selected part to change its size, drag a coloured ring to turn it, drag the background to turn the view.')} role="img">
      <Canvas frameloop="demand" onPointerMissed={() => props.onSelect(null)} dpr={[1, 2]}>
        <Scene {...props} />
      </Canvas>
      <p className="pointer-events-none absolute left-2 top-2 max-w-[22rem] rounded-md bg-[var(--studio-surface)]/90 px-2 py-1 text-xs text-[var(--studio-ink-secondary)]">
        {t('Drag a part to move it. Hold Shift to lift it. Drag a square handle on the selected part to change its size. Drag a coloured ring to turn it. Drag the background to turn the view.')}
      </p>
    </div>
  );
}
