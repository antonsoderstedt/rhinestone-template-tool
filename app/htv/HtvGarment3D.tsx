'use client';

/**
 * 3D garment preview — an alternative view mode alongside the 2D canvas and
 * flat-photo garment views (never a replacement for either; see
 * HtvTopbar's canvas/garment/3d toggle). Renders a low-poly, proportioned
 * garment (torso + sleeves + optional hood, or a bag for totes) built from
 * primitives, not a licensed 3D garment model — good enough to see how a
 * front print sits and curves on a rotatable body, not a photoreal render.
 *
 * The front-placement design is rasterized from the same <HtvLayerShape>
 * components the 2D views use (via a hidden, off-screen SVG + a
 * MutationObserver to catch async text-glyph loading), then applied as a
 * texture on a slightly-raised curved panel over the torso's front face —
 * simpler and more robust than computing exact cylindrical UVs for the
 * whole garment.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { getGarmentColor, getPrintAreaMm, normalizeGarmentType, type SelectableGarmentType } from '../components/garmentPreview/garmentCatalog';
import type { GarmentSize } from '../components/garmentPreview/garmentCatalog';
import { HTV_WORKSPACE_SIZE_MM, polylinesToPathD } from './htvGeometry';
import { getHtvColor } from './htvMaterialCatalog';
import { loadOutlineFont, layoutTextToOpenTypePolylines, type Polyline } from '@/src/lib/rhinestone-engine/index';
import type { HtvLayer, HtvState } from './HtvState';

const TEXTURE_PX = 768;

interface Garment3DProfile {
  /** Torso outer radius at hem, waist, chest (widest), and shoulder (narrowest, forms the shoulder taper) — a straight cylinder reads as a pipe, so the torso is a revolved (Lathe) profile through these four widths instead. */
  hemRadius: number;
  waistRadius: number;
  chestRadius: number;
  shoulderRadius: number;
  torsoHeight: number;
  neckRadius: number;
  collarHeight: number;
  sleeveLength: number;
  sleeveRadiusShoulder: number;
  sleeveRadiusCuff: number;
  /** Degrees below horizontal the sleeve hangs at. */
  sleeveAngleDeg: number;
  hasHood: boolean;
  isTote: boolean;
  printWidthFrac: number;
  printHeightFrac: number;
  printCenterYFrac: number;
}

/** Approximate proportions per garment, tuned by eye — not manufacturing specs. */
const GARMENT_3D_PROFILES: Record<SelectableGarmentType, Garment3DProfile> = {
  tee: {
    hemRadius: 0.66, waistRadius: 0.6, chestRadius: 0.64, shoulderRadius: 0.5,
    torsoHeight: 1.55, neckRadius: 0.19, collarHeight: 0.05,
    sleeveLength: 0.3, sleeveRadiusShoulder: 0.205, sleeveRadiusCuff: 0.155, sleeveAngleDeg: 40,
    hasHood: false, isTote: false, printWidthFrac: 0.56, printHeightFrac: 0.5, printCenterYFrac: 0.02,
  },
  'oversized-tee': {
    hemRadius: 0.8, waistRadius: 0.78, chestRadius: 0.79, shoulderRadius: 0.62,
    torsoHeight: 1.68, neckRadius: 0.21, collarHeight: 0.05,
    sleeveLength: 0.34, sleeveRadiusShoulder: 0.24, sleeveRadiusCuff: 0.19, sleeveAngleDeg: 32,
    hasHood: false, isTote: false, printWidthFrac: 0.58, printHeightFrac: 0.52, printCenterYFrac: 0.05,
  },
  'cropped-tee': {
    hemRadius: 0.6, waistRadius: 0.56, chestRadius: 0.62, shoulderRadius: 0.48,
    torsoHeight: 1.05, neckRadius: 0.18, collarHeight: 0.045,
    sleeveLength: 0.27, sleeveRadiusShoulder: 0.19, sleeveRadiusCuff: 0.145, sleeveAngleDeg: 38,
    hasHood: false, isTote: false, printWidthFrac: 0.54, printHeightFrac: 0.46, printCenterYFrac: -0.02,
  },
  hoodie: {
    hemRadius: 0.78, waistRadius: 0.74, chestRadius: 0.77, shoulderRadius: 0.61,
    torsoHeight: 1.62, neckRadius: 0.23, collarHeight: 0.09,
    sleeveLength: 0.86, sleeveRadiusShoulder: 0.25, sleeveRadiusCuff: 0.155, sleeveAngleDeg: 26,
    hasHood: true, isTote: false, printWidthFrac: 0.5, printHeightFrac: 0.4, printCenterYFrac: 0.1,
  },
  tote: {
    hemRadius: 0.58, waistRadius: 0.58, chestRadius: 0.58, shoulderRadius: 0.58,
    torsoHeight: 1.02, neckRadius: 0, collarHeight: 0,
    sleeveLength: 0, sleeveRadiusShoulder: 0, sleeveRadiusCuff: 0, sleeveAngleDeg: 0,
    hasHood: false, isTote: true, printWidthFrac: 0.62, printHeightFrac: 0.5, printCenterYFrac: 0.02,
  },
};

/** Torso silhouette as a side-profile curve (radius at height), revolved into a Lathe — hem flares slightly, waist is the narrowest point, chest is widest, then it tapers again into the shoulder line. A straight cylinder here is what reads as a "pipe" rather than a shirt. */
function buildTorsoProfilePoints(p: Garment3DProfile): THREE.Vector2[] {
  const h = p.torsoHeight;
  const at = (frac: number, radius: number) => new THREE.Vector2(radius, frac * h - h / 2);
  return [
    at(0, p.hemRadius),
    at(0.16, p.waistRadius),
    at(0.52, p.chestRadius),
    at(0.8, p.chestRadius * 0.93),
    at(0.94, (p.chestRadius + p.shoulderRadius) / 2),
    at(1, p.shoulderRadius),
  ];
}

/**
 * Real scanned/modeled garment meshes (user-supplied .glb files, copied into
 * `public/models/`), used instead of the procedural Lathe/cylinder body
 * below wherever one exists. Oversized and cropped tees reuse the same tee
 * mesh with a size adjustment — there's no separate scan for those cuts —
 * everything else (hoodie) has its own model. Tote has no supplied model
 * and still uses the procedural box+handles shape further down.
 */
const REAL_MODEL_URL: Partial<Record<SelectableGarmentType, string>> = {
  tee: '/models/tee-real.glb',
  'oversized-tee': '/models/tee-real.glb',
  'cropped-tee': '/models/tee-real.glb',
  hoodie: '/models/hoodie-real.glb',
};

/** Extra scale on top of the model's own auto-normalized size, since oversized/cropped tees are the same base scan. */
const REAL_MODEL_SIZE_ADJUST: Record<SelectableGarmentType, THREE.Vector3Tuple> = {
  tee: [1, 1, 1],
  'oversized-tee': [1.16, 1.08, 1.2],
  'cropped-tee': [1, 0.7, 1],
  hoodie: [1, 1, 1],
  tote: [1, 1, 1],
};

/**
 * Per-model front-facing print panel placement. widthFrac/heightFrac scale
 * the *real* full-front print area (same mm figures the 2D garment view
 * uses, via getPrintAreaMm) — 1.0 would be the full physical print area;
 * slightly under 1 leaves a small margin so content doesn't touch the
 * panel's edge. These are not fractions of the mesh's own bounding box.
 */
interface RealModelPrintPlacement {
  widthFrac: number;
  heightFrac: number;
  centerYFrac: number;
  zMargin: number;
  /** Some scans face -Z by default; rotate the whole model 180° so the front actually faces the camera. */
  faceBackward: boolean;
}
const REAL_MODEL_PRINT: Record<SelectableGarmentType, RealModelPrintPlacement> = {
  tee: { widthFrac: 0.92, heightFrac: 0.92, centerYFrac: 0.08, zMargin: 1.04, faceBackward: false },
  'oversized-tee': { widthFrac: 0.92, heightFrac: 0.92, centerYFrac: 0.08, zMargin: 1.04, faceBackward: false },
  'cropped-tee': { widthFrac: 0.92, heightFrac: 0.92, centerYFrac: 0.08, zMargin: 1.04, faceBackward: false },
  hoodie: { widthFrac: 0.92, heightFrac: 0.92, centerYFrac: 0.02, zMargin: 1.04, faceBackward: false },
  tote: { widthFrac: 0.62, heightFrac: 0.5, centerYFrac: 0.02, zMargin: 1.04, faceBackward: false },
};

const FABRIC_ROUGHNESS = 0.86;
/** Front-to-back flattening applied to the torso mesh so it reads as an oval body, not a perfect cylinder. */
const TORSO_Z_SCALE = 0.74;

/**
 * Lazily constructs a canvas + THREE.CanvasTexture once and hands back the
 * same pair on every render. A CanvasTexture is an inherently mutable,
 * imperative three.js handle — flipping `.needsUpdate` after the backing
 * canvas is redrawn is the standard, documented way to tell three.js the
 * pixels changed — so it's built via a ref, not useMemo/useState, and the
 * one-time lazy-init read is a deliberate, narrowly-scoped exception to the
 * render-purity lint rules (which model hook return values as immutable
 * pure data, not imperative GPU resource handles).
 */
function useMutableCanvasTexture(): { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture; markDirty: () => void } {
  const ref = useRef<{ canvas: HTMLCanvasElement; texture: THREE.CanvasTexture; markDirty: () => void } | null>(null);
  // eslint-disable-next-line react-hooks/refs -- one-time construction of an imperative three.js handle, not render output; see doc comment above.
  if (!ref.current) {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_PX;
    canvas.height = TEXTURE_PX;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    // The mutation lives inside the hook that owns the object, per the
    // immutability lint rule's own guidance, rather than the caller
    // touching `texture.needsUpdate` directly.
    const markDirty = () => { texture.needsUpdate = true; };
    ref.current = { canvas, texture, markDirty };
  }
  // eslint-disable-next-line react-hooks/refs -- reading the already-constructed handle back out; see doc comment above.
  return ref.current;
}

// ─── Off-screen rasterizer: the same <HtvLayerShape> tree the 2D views use, hidden and captured to a canvas texture. ──

/**
 * Applies a layer's translate/rotate/scale(+flip) transform to its local
 * polylines, matching the same math the 2D canvas/garment views use
 * (`translate(x y) rotate(rotationDeg) scale(scale*flip)`), so the 3D
 * texture lines up with what the layer actually looks like elsewhere.
 */
function transformLayerPolylines(layer: HtvLayer, polylines: Polyline[]): Polyline[] {
  const theta = (layer.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const sx = layer.scale * (layer.flipX ? -1 : 1);
  const sy = layer.scale * (layer.flipY ? -1 : 1);
  return polylines.map((polyline) => ({
    closed: polyline.closed,
    points: polyline.points.map((point) => {
      const px = point.x * sx;
      const py = point.y * sy;
      return {
        x: layer.x + px * cos - py * sin,
        y: layer.y + px * sin + py * cos,
      };
    }),
  }));
}

async function resolveLayerPolylines(layer: HtvLayer): Promise<Polyline[]> {
  if (layer.type === 'vector') {
    const excluded = new Set(layer.excludedContours);
    return excluded.size === 0 ? layer.polylines : layer.polylines.filter((_, i) => !excluded.has(i));
  }
  if (!layer.fontId || !layer.text.trim()) return [];
  const loaded = await loadOutlineFont(layer.fontId);
  if (!loaded.font) return [];
  return layoutTextToOpenTypePolylines({
    text: layer.text,
    font: loaded.font,
    fontSizeMm: layer.fontSizeMm,
    align: layer.align,
    letterSpacingMm: layer.letterSpacingMm,
  });
}

/**
 * Draws the current front-placement layers directly onto the shared
 * texture canvas with the Canvas 2D API (Path2D fills), rather than
 * rasterizing an off-screen SVG through an `<img>` — `drawImage()` from an
 * SVG data URI turned out to silently paint nothing in this environment
 * despite `onload`/`decode()` reporting success, so direct vector drawing
 * sidesteps that entirely and needs no hidden DOM or MutationObserver.
 */
function FrontDesignRasterizer({
  state,
  canvas,
  onDraw,
}: {
  state: HtvState;
  canvas: HTMLCanvasElement;
  onDraw: () => void;
}) {
  const frontLayers = useMemo(
    () => state.layers.filter((layer) => layer.visible && layer.placementId === state.garment.placementZone),
    [state.layers, state.garment.placementZone],
  );

  useEffect(() => {
    let cancelled = false;
    const scale = TEXTURE_PX / HTV_WORKSPACE_SIZE_MM;
    const originPx = TEXTURE_PX / 2;

    (async () => {
      const resolved = await Promise.all(
        frontLayers.map(async (layer) => ({
          layer,
          polylines: transformLayerPolylines(layer, await resolveLayerPolylines(layer)),
        })),
      );
      if (cancelled) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, TEXTURE_PX, TEXTURE_PX);
      ctx.save();
      ctx.translate(originPx, originPx);
      ctx.scale(scale, scale);
      for (const { layer, polylines } of resolved) {
        if (polylines.length === 0) continue;
        const path = new Path2D(polylinesToPathD(polylines));
        ctx.fillStyle = getHtvColor(layer.colorId).hex;
        ctx.fill(path, 'nonzero');
      }
      ctx.restore();
      onDraw();
    })();

    return () => {
      cancelled = true;
    };
  }, [frontLayers, canvas, onDraw]);

  return null;
}

// ─── 3D garment mesh ──────────────────────────────────────────────────────

/** Target world-space height every real model is normalized to, so they all sit at roughly the scale the camera/OrbitControls distances were tuned for. */
const REAL_MODEL_TARGET_HEIGHT = 1.55;

/**
 * Loads a real .glb garment scan, auto-centers and scales it to a
 * consistent size (scans come in whatever arbitrary unit/scale their author
 * used), tints its material to the chosen garment color (keeping any
 * baked-in diffuse/normal texture detail — this multiplies a color over the
 * existing map rather than replacing the material), and places the front
 * print panel using the mesh's own measured bounding box rather than a
 * hand-guessed constant.
 */
function RealGarmentModel({
  garmentType,
  garmentSize,
  fabricColorHex,
  printMaterial,
}: {
  garmentType: SelectableGarmentType;
  garmentSize: GarmentSize;
  fabricColorHex: string;
  printMaterial: THREE.Material;
}) {
  const url = REAL_MODEL_URL[garmentType]!;
  const { scene } = useGLTF(url);
  const placement = REAL_MODEL_PRINT[garmentType];
  const adjust = REAL_MODEL_SIZE_ADJUST[garmentType];

  const prepared = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const scaleFactor = REAL_MODEL_TARGET_HEIGHT / (size.y || 1);
    return { clone, size, center, scaleFactor };
  }, [scene]);

  useEffect(() => {
    prepared.clone.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of materials) {
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.color.set(fabricColorHex);
          mat.roughness = FABRIC_ROUGHNESS;
        }
      }
    });
  }, [prepared.clone, fabricColorHex]);

  const { clone, size, center, scaleFactor } = prepared;
  const scaleX = scaleFactor * adjust[0];
  const scaleY = scaleFactor * adjust[1];
  const scaleZ = scaleFactor * adjust[2];
  // glTF's spec-mandated unit is meters, and `scaleFactor` maps those native
  // meters to scene units — so real print-area mm (the same numbers the 2D
  // garment view uses) convert to scene units directly, instead of the
  // print panel being sized off the mesh's own bounding box. That bounding
  // box includes the sleeves splayed out, so a fraction of *that* width
  // sized a panel far wider than the actual chest print area — content
  // authored for a ~300mm-wide placement was stretched across ~650mm and
  // spilled past the garment's silhouette entirely.
  const printArea = getPrintAreaMm(garmentType, garmentSize);
  const mmToSceneUnits = scaleFactor / 1000;
  const printWidth = printArea.widthMm * mmToSceneUnits * placement.widthFrac;
  const printHeight = printArea.heightMm * mmToSceneUnits * placement.heightFrac;
  const printZ = ((size.z * scaleZ) / 2) * placement.zMargin;

  return (
    <group>
      <group
        scale={[scaleX, scaleY, scaleZ]}
        position={[-center.x * scaleX, -center.y * scaleY, -center.z * scaleZ]}
        rotation={placement.faceBackward ? [0, Math.PI, 0] : [0, 0, 0]}
      >
        <primitive object={clone} />
      </group>
      <mesh position={[0, placement.centerYFrac, printZ]} material={printMaterial}>
        <planeGeometry args={[printWidth, printHeight]} />
      </mesh>
    </group>
  );
}

function SlowSpin({ children, spinning }: { children: React.ReactNode; spinning: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (spinning && group.current) group.current.rotation.y += delta * 0.28;
  });
  return <group ref={group}>{children}</group>;
}

function GarmentMesh({ state, texture }: { state: HtvState; texture: THREE.CanvasTexture }) {
  const garmentType = normalizeGarmentType(state.garment.type);
  const profile = GARMENT_3D_PROFILES[garmentType];
  const color = getGarmentColor(state.garment.colorId);

  const fabricMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: color.hex, roughness: FABRIC_ROUGHNESS, metalness: 0.02, side: THREE.DoubleSide }),
    [color.hex],
  );

  const printMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ map: texture, transparent: true, depthWrite: false, roughness: FABRIC_ROUGHNESS, metalness: 0, side: THREE.DoubleSide }),
    [texture],
  );

  const realModelUrl = REAL_MODEL_URL[garmentType];
  if (realModelUrl) {
    return (
      <RealGarmentModel
        garmentType={garmentType}
        garmentSize={state.garment.size}
        fabricColorHex={color.hex}
        printMaterial={printMaterial}
      />
    );
  }

  if (profile.isTote) {
    const printArc = profile.printWidthFrac * profile.chestRadius * 1.62;
    return (
      <group position={[0, -0.05, 0]}>
        <mesh material={fabricMaterial}>
          <boxGeometry args={[profile.chestRadius * 1.7, profile.torsoHeight, profile.chestRadius * 0.55]} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * profile.chestRadius * 0.55, profile.torsoHeight / 2 + 0.06, 0]} rotation={[Math.PI / 2, 0, 0]} material={fabricMaterial}>
            <torusGeometry args={[0.13, 0.028, 10, 24, Math.PI]} />
          </mesh>
        ))}
        <mesh
          position={[0, profile.printCenterYFrac, profile.chestRadius * 0.278]}
          material={printMaterial}
        >
          <planeGeometry args={[printArc, profile.printHeightFrac * profile.torsoHeight]} />
        </mesh>
      </group>
    );
  }

  const printWidth = profile.printWidthFrac * profile.chestRadius * 2;
  const printHeight = profile.printHeightFrac * profile.torsoHeight;
  // The torso mesh is flattened front-to-back by TORSO_Z_SCALE, so its
  // front surface sits at chestRadius * TORSO_Z_SCALE from the center, not
  // at chestRadius — the print panel needs a matching z offset plus a
  // small margin, or it renders embedded inside the torso volume.
  const printZ = profile.chestRadius * TORSO_Z_SCALE * 1.06;
  const torsoProfilePoints = buildTorsoProfilePoints(profile);
  const shoulderY = profile.torsoHeight / 2 - profile.torsoHeight * 0.06;
  const shoulderX = profile.shoulderRadius * 0.94;

  return (
    <group position={[0, -0.1, 0]}>
      {/* Torso — a revolved (Lathe) silhouette, not a plain cylinder, so it actually tapers hem→waist→chest→shoulder like a garment instead of reading as a pipe. */}
      <mesh material={fabricMaterial} scale={[1, 1, TORSO_Z_SCALE]}>
        <latheGeometry args={[torsoProfilePoints, 40]} />
      </mesh>

      {/* Sleeves — short, tapered (wide at the shoulder, narrow at the cuff), angled down from the shoulder by sleeveAngleDeg below horizontal. */}
      {[-1, 1].map((side) => {
        const phi = (profile.sleeveAngleDeg * Math.PI) / 180;
        const dirX = Math.cos(phi);
        const dirY = -Math.sin(phi);
        const rotZ = -side * (Math.PI / 2 + phi);
        // Start the sleeve slightly inside the torso surface so the join is hidden, not floating with a visible gap.
        const originX = side * shoulderX * 0.82;
        const originY = shoulderY;
        const centerX = originX + side * dirX * (profile.sleeveLength / 2);
        const centerY = originY + dirY * (profile.sleeveLength / 2);
        return (
          <group key={side}>
            <mesh material={fabricMaterial} position={[centerX, centerY, 0]} rotation={[0, 0, rotZ]}>
              <cylinderGeometry args={[profile.sleeveRadiusCuff, profile.sleeveRadiusShoulder, profile.sleeveLength, 20, 1, true]} />
            </mesh>
            {/* Shoulder blend — softens the seam where the sleeve meets the torso. */}
            <mesh material={fabricMaterial} position={[originX, originY, 0]}>
              <sphereGeometry args={[profile.sleeveRadiusShoulder * 0.92, 16, 12]} />
            </mesh>
          </group>
        );
      })}

      {/* Collar — a short standing rib, not just a bare open edge, so the neckline actually reads as a finished garment opening. */}
      <mesh position={[0, profile.torsoHeight / 2 + profile.collarHeight / 2 - 0.01, 0]} material={fabricMaterial}>
        <cylinderGeometry args={[profile.neckRadius, profile.neckRadius * 0.96, profile.collarHeight, 28, 1, true]} />
      </mesh>

      {/* Hood (hoodie only) */}
      {profile.hasHood && (
        <mesh position={[0, profile.torsoHeight / 2 + 0.14, -profile.chestRadius * 0.3]} rotation={[0.35, 0, 0]} material={fabricMaterial}>
          <sphereGeometry args={[profile.chestRadius * 0.5, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        </mesh>
      )}

      {/* Front print panel — a flat plane just outside the torso's front surface, facing the camera by default (PlaneGeometry's normal is +Z). Flat rather than curved: simpler and more robust than a curved decal, and a completely standard simplification for this kind of preview. */}
      <mesh position={[0, profile.printCenterYFrac, printZ]} material={printMaterial}>
        <planeGeometry args={[printWidth, printHeight]} />
      </mesh>
    </group>
  );
}

/**
 * WebGL contexts can be lost (GPU driver reset, tab backgrounded under
 * memory pressure, too many contexts open at once) — without handling
 * this, the canvas just freezes on its last frame or goes blank forever.
 * `preventDefault()` on the loss event is what tells the browser recovery
 * is possible at all; without it, `webglcontextrestored` never fires.
 */
function useWebglContextRecovery() {
  const [lost, setLost] = useState(false);
  const [remountKey, setRemountKey] = useState(0);

  const onCreated = useCallback((canvasState: { gl: THREE.WebGLRenderer }) => {
    const canvasEl = canvasState.gl.domElement;
    const handleLost = (event: Event) => {
      event.preventDefault();
      setLost(true);
    };
    const handleRestored = () => setLost(false);
    canvasEl.addEventListener('webglcontextlost', handleLost);
    canvasEl.addEventListener('webglcontextrestored', handleRestored);
  }, []);

  const retry = useCallback(() => {
    setLost(false);
    setRemountKey((k) => k + 1);
  }, []);

  return { lost, remountKey, onCreated, retry };
}

export default function HtvGarment3D({ state }: { state: HtvState }) {
  const { canvas: textureCanvas, texture, markDirty } = useMutableCanvasTexture();
  const { lost, remountKey, onCreated, retry } = useWebglContextRecovery();

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: 'radial-gradient(circle at 50% 30%, #2c2c33, #17171a 72%)' }}>
      <Canvas
        key={remountKey}
        camera={{ position: [0, 0.05, 3.4], fov: 30 }}
        dpr={1}
        gl={{ powerPreference: 'low-power', antialias: true }}
        onCreated={onCreated}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 5, 5]} intensity={1.2} />
        <directionalLight position={[-4, 1.5, -3]} intensity={0.35} />
        <SlowSpin spinning={false}>
          <GarmentMesh state={state} texture={texture} />
        </SlowSpin>
        <OrbitControls
          enablePan={false}
          minDistance={2.1}
          maxDistance={6}
          minPolarAngle={Math.PI / 3.6}
          maxPolarAngle={Math.PI / 1.65}
        />
      </Canvas>
      <FrontDesignRasterizer state={state} canvas={textureCanvas} onDraw={markDirty} />
      {lost ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--studio-well)]/90">
          <p className="text-sm text-[var(--studio-ink-secondary)]">The 3D preview lost its graphics context.</p>
          <button
            type="button"
            onClick={retry}
            className="rounded-md bg-violet-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-400"
          >
            Reload 3D preview
          </button>
        </div>
      ) : (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-[var(--studio-border)] bg-black/40 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--studio-ink-muted)]">
          Drag to rotate · scroll to zoom
        </div>
      )}
    </div>
  );
}
