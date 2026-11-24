declare module 'subset-font' {
  export interface SubsetFontOptions {
    targetFormat?: 'sfnt' | 'woff' | 'woff2' | 'truetype';
  }
  export default function subsetFont(font: Buffer | Uint8Array, text: string, options?: SubsetFontOptions): Promise<Buffer>;
}
