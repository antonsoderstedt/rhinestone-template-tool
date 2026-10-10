'use client';

import Image from 'next/image';
import type { GarmentColorSwatch } from '../components/garmentPreview/garmentCatalog';

interface HtvMockupImageProps {
  imageSrc: string;
  alt: string;
  color: GarmentColorSwatch;
}

export default function HtvMockupImage({ imageSrc, alt, color }: HtvMockupImageProps) {
  const maskStyle = {
    backgroundColor: color.hex,
    WebkitMaskImage: `url(${imageSrc})`,
    maskImage: `url(${imageSrc})`,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
  } as const;

  const shadowLayerStyle = {
    mixBlendMode: 'multiply' as const,
    opacity: color.shade === 'dark' ? 0.34 : 0.2,
    filter: color.shade === 'dark' ? 'grayscale(1) contrast(1.24) brightness(0.42)' : 'grayscale(1) contrast(1.08) brightness(0.92)',
  };

  const highlightLayerStyle = {
    mixBlendMode: 'screen' as const,
    opacity: color.shade === 'dark' ? 0.05 : 0.12,
    filter: color.shade === 'dark' ? 'grayscale(1) contrast(1.04) brightness(1.16)' : 'grayscale(1) contrast(1.02) brightness(1.12)',
  };

  return (
    <div role="img" aria-label={alt} className="pointer-events-none absolute inset-0 isolate">
      <div aria-hidden className="absolute inset-0 bg-center bg-no-repeat" style={maskStyle} />
      <Image
        src={imageSrc}
        alt=""
        aria-hidden="true"
        fill
        unoptimized
        sizes="100vw"
        className="absolute inset-0 object-contain"
        style={shadowLayerStyle}
      />
      <Image
        src={imageSrc}
        alt=""
        aria-hidden="true"
        fill
        unoptimized
        sizes="100vw"
        className="absolute inset-0 object-contain"
        style={highlightLayerStyle}
      />
    </div>
  );
}