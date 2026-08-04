import type { RasterArtworkImageData } from '@/src/lib/rhinestone-engine/index';

export async function decodeRasterImageDataUrl(dataUrl: string): Promise<RasterArtworkImageData> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new Image();
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error('Could not decode the uploaded image.'));
    nextImage.src = dataUrl;
  });

  const widthPx = image.naturalWidth || image.width;
  const heightPx = image.naturalHeight || image.height;
  if (widthPx <= 0 || heightPx <= 0) {
    throw new Error('Uploaded image has invalid dimensions.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Browser could not open a pixel buffer for this image.');
  }

  context.drawImage(image, 0, 0, widthPx, heightPx);
  const imageData = context.getImageData(0, 0, widthPx, heightPx);
  return {
    widthPx,
    heightPx,
    rgba: imageData.data,
  };
}