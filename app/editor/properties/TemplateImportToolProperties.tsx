'use client';

import { createImportedTemplate } from '@/src/lib/rhinestone-engine/index';
import StoneProfileControl from '../controls/StoneProfileControl';
import DesignCollectionPicker from '../controls/DesignCollectionPicker';
import { useT } from '../../lib/i18n';
import { ToolPropertiesProps } from './shared';

export function TemplateImportToolProperties({ state, dispatch }: ToolPropertiesProps) {
  const t = useT();
  const { templateImportTool } = state;

  // Checks a template's SVG and puts it up for import; shared by a file from the computer and a design from the collection.
  const loadSvgText = (svgText: string, fileName: string) => {
    try {
      const result = createImportedTemplate({
        svgText,
        defaultStoneSizeId: templateImportTool.defaultStoneSize,
        deduplicateTolerance: 0.01,
      });
      if (result.template.stones.length === 0) {
        dispatch({
          type: 'UPDATE_TEMPLATE_IMPORT_TOOL',
          updates: {
            pendingSvgText: null,
            pendingFileName: fileName,
            importError: 'No identifiable stones found. Use SVG Convert Shape if this file contains artwork rather than a rhinestone template.',
            importSummary: null,
          },
        });
        return;
      }

      dispatch({
        type: 'UPDATE_TEMPLATE_IMPORT_TOOL',
        updates: {
          pendingSvgText: svgText,
          pendingFileName: fileName,
          detectedDiameters: result.detectedDiameters,
          detectedColors: result.detectedColors,
          ignoredElements: result.ignoredElements,
          warnings: result.warnings,
          importSummary: `${result.template.stones.length} stones ready to import`,
          importError: null,
        },
      });
    } catch (error) {
      dispatch({
        type: 'UPDATE_TEMPLATE_IMPORT_TOOL',
        updates: {
          pendingSvgText: null,
          pendingFileName: fileName,
          importSummary: null,
          importError: error instanceof Error ? error.message : String(error),
        },
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => loadSvgText(typeof reader.result === 'string' ? reader.result : '', file.name);
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmImport = () => {
    if (!templateImportTool.pendingSvgText) return;
    dispatch({
      type: 'UPDATE_TEMPLATE_IMPORT_TOOL',
      updates: {
        uploadedSvgText: templateImportTool.pendingSvgText,
        svgFileName: templateImportTool.pendingFileName,
        pendingSvgText: null,
        pendingFileName: null,
        importError: null,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-info-500/30 bg-info-50 px-3 py-3 text-xs text-info-600">
        {t('Imports circles already positioned as stones. For a logo or ordinary vector shape, choose SVG Convert Shape instead.')}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-secondary">{t('Existing rhinestone template')}</span>
        <input
          aria-label={t('Existing rhinestone template')}
          type="file"
          accept=".svg,image/svg+xml"
          onChange={handleFileSelect}
          className="text-xs text-ink-secondary file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-accent-500 file:px-3 file:py-2 file:text-xs file:font-medium file:text-ink-inverse hover:file:bg-accent-600"
        />
      </label>

      <DesignCollectionPicker onPick={(svgText, fileName) => loadSvgText(svgText, fileName)} />

      <StoneProfileControl
        value={templateImportTool.defaultStoneSize}
        onChange={(defaultStoneSize) => dispatch({
          type: 'UPDATE_TEMPLATE_IMPORT_TOOL',
          updates: { defaultStoneSize },
        })}
      />
      <p className="-mt-2 text-xs text-ink-muted">
        {t('Fallback label only. Imported circle diameter remains unchanged.')}
      </p>

      {templateImportTool.importError && (
        <div role="alert" className="rounded-xl border border-danger-500/30 bg-danger-50 px-3 py-3 text-xs text-danger-600">
          {templateImportTool.importError}
        </div>
      )}

      {templateImportTool.pendingSvgText && (
        <div className="space-y-3 rounded-xl border border-border bg-surface-sunken px-3 py-3 text-xs text-ink-secondary">
          <p className="font-medium text-ink">{templateImportTool.importSummary}</p>
          <p>Diameters: {templateImportTool.detectedDiameters.join(', ')} mm</p>
          <p>Colors: {templateImportTool.detectedColors.join(', ') || 'none'}</p>
          <p>Ignored decorative elements: {templateImportTool.ignoredElements}</p>
          {templateImportTool.warnings.map((warning) => <p key={warning} className="text-warning-600">{warning}</p>)}
          <button
            type="button"
            onClick={confirmImport}
            className="w-full rounded-lg bg-accent-500 px-3 py-2 text-sm font-medium text-ink-inverse hover:bg-accent-600"
          >
            {t('Import stones to canvas')}
          </button>
        </div>
      )}

      {templateImportTool.uploadedSvgText && (
        <p className="text-xs text-success-600">
          Imported: {templateImportTool.svgFileName ?? 'template.svg'}
        </p>
      )}
    </div>
  );
}
