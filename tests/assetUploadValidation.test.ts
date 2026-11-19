import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ASSET_UPLOAD_MAX_SIZE_BYTES,
  validateAssetUpload,
} from '../src/lib/rhinestone-engine/index';

describe('validateAssetUpload', () => {
  it('accepts a parseable SVG with supported shapes', () => {
    const result = validateAssetUpload({
      fileName: 'star.svg',
      mimeType: 'image/svg+xml',
      sizeBytes: 512,
      svgText: '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="5" /></svg>',
    });
    expect(result.valid).toBe(true);
    expect(result.code).toBe('ok');
  });

  it('rejects a non-parseable SVG', () => {
    const result = validateAssetUpload({
      fileName: 'broken.svg',
      mimeType: 'image/svg+xml',
      sizeBytes: 128,
      svgText: 'not-an-svg',
    });
    expect(result.valid).toBe(false);
    expect(result.code).toBe('not_a_valid_svg');
  });

  it('rejects SVG files that contain no supported shapes', () => {
    const result = validateAssetUpload({
      fileName: 'empty.svg',
      mimeType: 'image/svg+xml',
      sizeBytes: 128,
      svgText: '<svg xmlns="http://www.w3.org/2000/svg"><defs></defs></svg>',
    });
    expect(result.valid).toBe(false);
    expect(result.code).toBe('no_supported_shapes');
  });

  it('rejects files above the upload size limit', () => {
    const result = validateAssetUpload({
      fileName: 'too-large.svg',
      mimeType: 'image/svg+xml',
      sizeBytes: DEFAULT_ASSET_UPLOAD_MAX_SIZE_BYTES + 1,
      svgText: '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="5" /></svg>',
    });
    expect(result.valid).toBe(false);
    expect(result.code).toBe('file_too_large');
  });
});
