'use client';

import { useState } from 'react';
import { getTemplatePhysicalSize, validateAssetUpload, DEFAULT_ASSET_UPLOAD_MAX_SIZE_BYTES } from '@/src/lib/rhinestone-engine/index';
import StoneProfileControl from '../controls/StoneProfileControl';
import DensityControl from '../controls/DensityControl';
import PhysicalDimensionsControl from '../controls/PhysicalDimensionsControl';
import NumericInput from '../controls/NumericInput';
import ShapeGalleryPicker from '../controls/ShapeGalleryPicker';
import LibraryAssetPicker from '../controls/LibraryAssetPicker';
import { useLookThumbnails } from '../useLookThumbnails';
import { ArtworkAdvice, ArtworkLayersList, ArtworkLookControl } from '../controls/ArtworkControls';
import { ARTWORK_LOOKS, lookFromCoverage } from '../artworkGeneration';
import { useT } from '../../lib/i18n';
import { ToolPropertiesProps } from './shared';

export function SvgToolProperties({ state, dispatch, artworkInfo = null }: ToolPropertiesProps) {
  const t = useT();
  const { svgTool } = state;
  const lookThumbnails = useLookThumbnails(svgTool);
  // Why the last file was refused, shown under the file picker until a good file is loaded.
  const [uploadError, setUploadError] = useState<string | null>(null);
  const currentTemplateSize = state.template ? getTemplatePhysicalSize(state.template) : null;
  const scaledWidthMm = typeof svgTool.targetWidthMm === 'number'
    ? svgTool.targetWidthMm
    : currentTemplateSize?.widthMm ?? null;
  const scaledHeightMm = typeof svgTool.targetHeightMm === 'number'
    ? svgTool.targetHeightMm
    : currentTemplateSize?.heightMm ?? null;
  const scaledStoneCount = state.template?.stones.length ?? 0;
  const currentArtworkName = svgTool.assetKind === 'image' ? svgTool.imageFileName : svgTool.svgFileName;
  const uploadInputId = 'artwork-upload-input';
  const loadArtworkFile = (file: File | null | undefined) => {
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isSvg = file.type === 'image/svg+xml' || lowerName.endsWith('.svg');

    // A file that is too large is refused before it is read; an SVG is also checked once its text is known.
    if (file.size > DEFAULT_ASSET_UPLOAD_MAX_SIZE_BYTES) {
      setUploadError(`${file.name}: ${validateAssetUpload({ fileName: file.name, sizeBytes: file.size, svgText: null }).message}`);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => setUploadError(`${file.name}: the file could not be read.`);
    reader.onload = () => {
      if (isSvg) {
        const svgText = reader.result as string;
        const check = validateAssetUpload({ fileName: file.name, mimeType: file.type, sizeBytes: file.size, svgText });
        if (!check.valid) {
          setUploadError(`${file.name}: ${check.message} Nothing was changed — pick a different file.`);
          return;
        }
        setUploadError(null);
        dispatch({
          type: 'UPDATE_SVG_TOOL',
          updates: {
            assetKind: 'svg',
            uploadedSvgText: svgText,
            svgFileName: file.name,
            uploadedImageDataUrl: null,
            imageFileName: null,
          },
        });
      } else {
        setUploadError(null);
        dispatch({
          type: 'UPDATE_SVG_TOOL',
          updates: {
            assetKind: 'image',
            uploadedImageDataUrl: reader.result as string,
            imageFileName: file.name,
            uploadedSvgText: null,
            svgFileName: null,
          },
        });
      }
    };
    if (isSvg) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    loadArtworkFile(file);
    e.target.value = ''; // Reset for re-upload
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    loadArtworkFile(e.dataTransfer.files?.[0]);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const fileItem = Array.from(e.clipboardData.items).find((item) => item.kind === 'file');
    if (!fileItem) return;
    e.preventDefault();
    loadArtworkFile(fileItem.getAsFile());
  };

  const sharedArtworkControls = (
    <>
          <ArtworkLookControl
            thumbnails={lookThumbnails}
            look={lookFromCoverage(svgTool.coverageMode)}
            rowCount={svgTool.contourSettings.rowCount}
            onLookChange={(look) => {
              const option = ARTWORK_LOOKS.find((entry) => entry.look === look)!;
              dispatch({ type: 'UPDATE_SVG_TOOL', updates: { coverageMode: option.coverageMode, fillMode: look === 'outline' ? 'outline' : 'outline-fill' } });
            }}
            onRowCountChange={(rowCount) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { contourSettings: { ...svgTool.contourSettings, rowCount } } })}
          />

          {artworkInfo && artworkInfo.source.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-ink-secondary">
              <input
                type="checkbox"
                checked={svgTool.showSourceBehind}
                onChange={(event) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { showSourceBehind: event.target.checked } })}
                className="h-3.5 w-3.5 rounded"
              />
              {t('Show the original behind the stones')}
            </label>
          )}

          {artworkInfo && (
            <ArtworkLayersList
              layers={artworkInfo.layers}
              stoneColours={svgTool.layerStoneColours}
              onStoneColour={(colour, hex) => {
                const next = { ...svgTool.layerStoneColours };
                if (hex) next[colour] = hex;
                else delete next[colour];
                dispatch({ type: 'UPDATE_SVG_TOOL', updates: { layerStoneColours: next } });
              }}
              onToggle={(colour, role) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { layerRoles: { ...svgTool.layerRoles, [colour]: role } } })}
            />
          )}

          {/* Stone Size */}
          <StoneProfileControl
            value={svgTool.stoneSize}
            onChange={(size) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { stoneSize: size } })}
          />

          {/* Target Dimensions */}
          {typeof scaledWidthMm === 'number' && typeof scaledHeightMm === 'number' && (
            <p className="rounded-xl border border-info-500/30 bg-info-500/10 px-3 py-2 text-xs text-info-700">
              {t('Scaled to {width} × {height} mm — change below. Stone count: {count}.', { width: scaledWidthMm.toFixed(1), height: scaledHeightMm.toFixed(1), count: scaledStoneCount ?? 0 })}
            </p>
          )}
          <PhysicalDimensionsControl
            widthMm={svgTool.targetWidthMm}
            heightMm={svgTool.targetHeightMm}
            preserveAspectRatio={svgTool.preserveAspectRatio}
            onWidthChange={(val) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { targetWidthMm: val } })}
            onHeightChange={(val) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { targetHeightMm: val } })}
            onPreserveAspectRatioChange={(val) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { preserveAspectRatio: val } })}
          />

          {artworkInfo && (
            <ArtworkAdvice
              info={artworkInfo}
              stoneSize={svgTool.stoneSize}
              onSetWidth={(widthMm) => {
                const ratio = artworkInfo.feasibility ? artworkInfo.feasibility.heightMm / Math.max(artworkInfo.feasibility.widthMm, 1e-6) : 1;
                dispatch({ type: 'UPDATE_SVG_TOOL', updates: { targetWidthMm: widthMm, targetHeightMm: svgTool.preserveAspectRatio ? Number((widthMm * ratio).toFixed(1)) : svgTool.targetHeightMm } });
              }}
              onSetStoneSize={(size) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { stoneSize: size } })}
            />
          )}

          {artworkInfo && artworkInfo.warnings.length > 0 && (
            <ul className="space-y-1 text-xs text-ink-muted" aria-label={t('Notes about this file')}>
              {artworkInfo.warnings.slice(0, 4).map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}

          {/* Density */}
          <DensityControl
            densityPreset={svgTool.densityPreset}
            customSpacingMm={svgTool.customSpacingMm}
            onDensityChange={(preset) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { densityPreset: preset } })}
            onCustomSpacingChange={(val) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { customSpacingMm: val } })}
          />
    </>
  );

  return (
    <div className="space-y-4">
      {/* File Upload */}
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-secondary">{t('Upload artwork')}</span>
        <div
          tabIndex={0}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onPaste={handlePaste}
          className="rounded-xl border border-dashed border-border bg-surface-sunken px-4 py-4 text-center text-sm text-ink-secondary transition hover:border-border-strong focus:border-accent-400"
        >
          <p>{t('Drag and drop or paste artwork here.')}</p>
          <p className="mt-1 text-xs text-ink-muted">{t('Use the file picker below if you prefer browsing.')}</p>
        </div>
        <input
          id={uploadInputId}
          type="file"
          accept=".svg,image/svg+xml,.png,.jpg,.jpeg,.webp,.bmp,.gif,image/png,image/jpeg,image/webp,image/bmp,image/gif"
          onChange={handleFileSelect}
          className="peer sr-only"
        />
        {/* The browser's own file button is in the browser's language; this one is ours. */}
        <span className="inline-flex w-fit cursor-pointer items-center rounded-md bg-accent-500 px-3 py-2 text-xs font-medium text-ink-inverse hover:bg-accent-600 peer-focus-visible:ring-2">
          Choose a file
        </span>
        <span className="text-xs text-ink-muted">{t('Supports SVG, PNG, JPG, WEBP, BMP, and GIF.')}</span>
        {uploadError && (
          <span role="alert" className="rounded-xl border border-danger-500/30 bg-danger-50 px-3 py-2 text-xs text-danger-600">{uploadError}</span>
        )}
        {currentArtworkName && (
          <span className="text-xs text-ink-secondary mt-1">📄 {currentArtworkName}</span>
        )}
      </label>

      <LibraryAssetPicker
        currentName={svgTool.assetKind === 'image' ? svgTool.imageFileName : svgTool.svgFileName}
        onPick={(asset) => {
          if (asset.kind === 'svg') {
            const check = validateAssetUpload({ fileName: asset.fileName, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes, svgText: asset.svgText });
            if (!check.valid) {
              setUploadError(`${asset.name}: ${check.message}`);
              return;
            }
            setUploadError(null);
            dispatch({ type: 'UPDATE_SVG_TOOL', updates: { assetKind: 'svg', uploadedSvgText: asset.svgText, svgFileName: asset.fileName, uploadedImageDataUrl: null, imageFileName: null } });
          } else {
            setUploadError(null);
            dispatch({ type: 'UPDATE_SVG_TOOL', updates: { assetKind: 'image', uploadedImageDataUrl: asset.sourceDataUrl, imageFileName: asset.fileName, uploadedSvgText: null, svgFileName: null } });
          }
        }}
      />

      <ShapeGalleryPicker
        selectedName={svgTool.assetKind === 'svg' ? svgTool.svgFileName : null}
        onPick={(shape) => {
          setUploadError(null);
          dispatch({
            type: 'UPDATE_SVG_TOOL',
            updates: { assetKind: 'svg', uploadedSvgText: shape.svg, svgFileName: shape.label, uploadedImageDataUrl: null, imageFileName: null, densityPreset: 'airy' },
          });
        }}
      />

      {svgTool.assetKind === 'image' && svgTool.uploadedImageDataUrl && (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-surface-sunken">
            <div className="border-b border-border px-3 py-2 text-xs font-medium text-ink-secondary">{t('Original image')}</div>
            {/* eslint-disable-next-line @next/next/no-img-element -- client-side data: URI, no network fetch for next/image to optimize */}
            <img
              src={svgTool.uploadedImageDataUrl}
              alt={currentArtworkName ?? 'Uploaded artwork preview'}
              className="max-h-56 w-full object-contain bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.14),_transparent_35%),linear-gradient(180deg,_#111827,_#09090b)]"
            />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium text-ink-secondary">{t('Number of stone colours')}</span>
            <div role="group" aria-label={t('Number of stone colours')} className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((count) => (
                <button
                  key={count}
                  type="button"
                  aria-pressed={(svgTool.imageColorCount ?? 1) === count}
                  onClick={() => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { imageColorCount: count as 1 | 2 | 3 | 4 } })}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${(svgTool.imageColorCount ?? 1) === count ? 'border-accent-400 bg-accent-50 text-ink' : 'border-border bg-surface-sunken text-ink-secondary hover:border-border hover:bg-surface-raised'}`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          {sharedArtworkControls}

          <NumericInput
            label={t('Brightness cutoff')}
            value={svgTool.imageThreshold}
            onChange={(value) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { imageThreshold: typeof value === 'number' ? value : 128 } })}
            min={0}
            max={255}
            step={1}
            helpText={t('Only used for pictures without a plain background. Lower keeps only the darker parts.')}
          />

          <NumericInput
            label={t('Detail')}
            value={svgTool.imageDetail}
            onChange={(value) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { imageDetail: typeof value === 'number' ? value : 128 } })}
            min={0}
            max={255}
            step={1}
            helpText={t('Higher keeps small details. Lower smooths away specks and holes.')}
          />

          <label className="flex items-center gap-2 text-sm text-ink-secondary">
            <input
              type="checkbox"
              checked={svgTool.imageInvert}
              onChange={(e) => dispatch({ type: 'UPDATE_SVG_TOOL', updates: { imageInvert: e.target.checked } })}
              className="h-3.5 w-3.5 rounded"
            />
            {t('Stones on the background instead of the shape')}
          </label>
        </>
      )}

      {svgTool.assetKind === 'svg' && svgTool.uploadedSvgText && <>{sharedArtworkControls}</>}
    </div>
  );
}
