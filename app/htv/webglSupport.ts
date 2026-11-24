/**
 * Can this browser create a WebGL context at all? The 3D preview needs one; on
 * some machines (GPU disabled, remote desktops, sandboxes, headless browsers)
 * it is simply not there, and the preview has to fall back instead of showing
 * a blank pane.
 */

interface ProbeCanvas {
  getContext(contextId: string): unknown;
}

interface LoseContextExtension {
  loseContext(): void;
}

interface ProbeContext {
  getExtension?: (name: string) => unknown;
}

/**
 * `createCanvas` is injectable so this can be tested without a DOM.
 * The probe context is released again, because browsers cap how many WebGL
 * contexts a page may hold (usually 16).
 */
export function isWebglAvailable(
  createCanvas: () => ProbeCanvas = () => document.createElement('canvas'),
): boolean {
  try {
    const canvas = createCanvas();
    const context = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as ProbeContext | null;
    if (!context) return false;
    const lose = context.getExtension?.('WEBGL_lose_context') as LoseContextExtension | null | undefined;
    lose?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export type Preview3dFailure = 'unsupported' | 'lost' | 'error';

/** What to tell the user when the 3D preview cannot be shown. */
export function describe3dFailure(failure: Preview3dFailure, detail?: string | null): string {
  switch (failure) {
    case 'unsupported':
      return "The 3D preview isn't available because this browser or device has WebGL turned off.";
    case 'lost':
      return 'The 3D preview lost its graphics context. This can happen when the GPU resets or many tabs are using graphics.';
    case 'error':
      return `The 3D preview could not load${detail ? ` (${detail})` : ''}.`;
  }
}
