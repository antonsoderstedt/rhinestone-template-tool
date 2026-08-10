'use client';

/**
 * Flat vector garment silhouettes for the mockup preview (v1 — see chat
 * decision log: real mockup photography will replace this once provided).
 *
 * Both garments share a 400x480 viewBox so the print-area reference box
 * math in `getPrintAreaBox` lines up with the drawn paths below.
 */

import type { GarmentColorSwatch, GarmentSize, GarmentType } from './garmentCatalog';
import { GARMENTS } from './garmentCatalog';

export const GARMENT_VIEWBOX = { width: 400, height: 480 };

const REFERENCE_BOX_BY_GARMENT: Record<GarmentType, { x: number; y: number; width: number; height: number }> = {
  tshirt: { x: 140, y: 140, width: 120, height: 160 },
  hoodie: { x: 140, y: 128, width: 120, height: 148 },
};

/**
 * Print-area rect in illustration coordinates for a given garment + size.
 * Scales the size's reference box uniformly relative to the M reference
 * size (see garmentCatalog.ts print-area mm tables) and keeps it centered
 * on the same anchor point so it reads as "the same spot, bigger/smaller."
 */
export function getPrintAreaBox(garmentId: GarmentType, size: GarmentSize) {
  const definition = GARMENTS.find((g) => g.id === garmentId)!;
  const reference = REFERENCE_BOX_BY_GARMENT[garmentId];
  const mSize = definition.printAreaMmBySize.M;
  const thisSize = definition.printAreaMmBySize[size];
  const scale = thisSize.widthMm / mSize.widthMm;

  const width = reference.width * scale;
  const height = reference.height * scale;
  const centerX = reference.x + reference.width / 2;
  const centerY = reference.y + reference.height / 2;

  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  };
}

function TshirtBody({ id, fill }: { id: string; fill: string }) {
  return (
    <path
      id={id}
      d="M 120 40 Q 200 85 280 40 L 345 85 Q 355 95 348 108 L 305 150 L 300 450 L 100 450 L 95 150 L 52 108 Q 45 95 55 85 Z"
      fill={fill}
      stroke="rgba(0,0,0,0.18)"
      strokeWidth={1.5}
    />
  );
}

function HoodieBody({ id, fill }: { id: string; fill: string }) {
  return (
    <>
      <path
        d="M 108 55 Q 200 5 292 55 L 292 95 Q 200 60 108 95 Z"
        fill={fill}
        stroke="rgba(0,0,0,0.18)"
        strokeWidth={1.5}
      />
      <path
        id={id}
        d="M 130 62 Q 200 100 270 62 L 355 100 Q 368 112 358 128 L 300 190 L 296 450 L 104 450 L 100 190 L 42 128 Q 32 112 45 100 Z"
        fill={fill}
        stroke="rgba(0,0,0,0.18)"
        strokeWidth={1.5}
      />
      <path
        d="M 130 300 Q 200 320 270 300 L 270 330 Q 200 348 130 330 Z"
        fill="none"
        stroke="rgba(0,0,0,0.22)"
        strokeWidth={1.5}
      />
      <line x1="188" y1="88" x2="184" y2="130" stroke="rgba(0,0,0,0.3)" strokeWidth={2} strokeLinecap="round" />
      <line x1="212" y1="88" x2="216" y2="130" stroke="rgba(0,0,0,0.3)" strokeWidth={2} strokeLinecap="round" />
      <circle cx="184" cy="134" r="4" fill="rgba(0,0,0,0.3)" />
      <circle cx="216" cy="134" r="4" fill="rgba(0,0,0,0.3)" />
    </>
  );
}

interface GarmentSilhouetteProps {
  garmentId: GarmentType;
  color: GarmentColorSwatch;
  size: GarmentSize;
  showPrintAreaGuide?: boolean;
  children?: React.ReactNode;
}

export default function GarmentSilhouette({ garmentId, color, size, showPrintAreaGuide = true, children }: GarmentSilhouetteProps) {
  const clipId = `garment-clip-${garmentId}`;
  const bodyId = `garment-body-${garmentId}`;
  const printArea = getPrintAreaBox(garmentId, size);
  const shadingFill = color.shade === 'light' ? 'rgba(0,0,0,1)' : 'rgba(255,255,255,1)';

  return (
    <svg
      viewBox={`0 0 ${GARMENT_VIEWBOX.width} ${GARMENT_VIEWBOX.height}`}
      className="h-full w-full"
      role="img"
      aria-label={`${garmentId === 'tshirt' ? 'T-shirt' : 'Hoodie'} mockup preview, size ${size}`}
    >
      <defs>
        <clipPath id={clipId}>
          <use href={`#${bodyId}`} />
        </clipPath>
        <radialGradient id="rhinestone-sparkle" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#e6ddff" />
          <stop offset="100%" stopColor="#8f6fe0" />
        </radialGradient>
      </defs>

      {garmentId === 'tshirt' ? <TshirtBody id={bodyId} fill={color.hex} /> : <HoodieBody id={bodyId} fill={color.hex} />}

      <g clipPath={`url(#${clipId})`}>
        <path d="M 40 40 L 200 40 L 120 460 L 40 460 Z" fill={shadingFill} opacity={0.05} />
        <path d="M 260 40 L 360 40 L 320 460 L 260 460 Z" fill={shadingFill} opacity={0.05} />
      </g>

      {showPrintAreaGuide && (
        <rect
          x={printArea.x}
          y={printArea.y}
          width={printArea.width}
          height={printArea.height}
          fill="none"
          stroke="rgba(124,77,255,0.55)"
          strokeWidth={1.5}
          strokeDasharray="6 5"
          rx={4}
        />
      )}

      {children}
    </svg>
  );
}
