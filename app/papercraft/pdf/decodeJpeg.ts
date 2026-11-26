import type { PixelImage } from '@/src/lib/papercraft-engine';

/** A JPEG as pixels, decoded by the browser (the engine has no JPEG decoder). Null when the browser cannot read it. */
export async function decodeJpegInBrowser(bytes: Uint8Array): Promise<PixelImage | null> {
  try {
    const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: 'image/jpeg' }));
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    bitmap.close();
    const rgb = new Uint8Array(canvas.width * canvas.height * 3);
    for (let i = 0; i < canvas.width * canvas.height; i++) {
      rgb[i * 3] = rgba[i * 4];
      rgb[i * 3 + 1] = rgba[i * 4 + 1];
      rgb[i * 3 + 2] = rgba[i * 4 + 2];
    }
    return { width: canvas.width, height: canvas.height, rgb };
  } catch {
    return null;
  }
}
