'use client';

import { Check, ChevronDown, Loader2, Type } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getOutlineFontFaceCss,
  getOutlineFontDefinition,
  listOutlineFonts,
} from '@/src/lib/rhinestone-engine/index';

export interface OutlineFontStatus {
  status: 'idle' | 'loading' | 'error';
  message: string | null;
  fontId: string;
}

interface FontPickerProps {
  value: string;
  previewText: string;
  onChange: (fontId: string) => void;
  status: OutlineFontStatus;
}

function getFontPolicyLabel(fontId: string): string {
  const font = getOutlineFontDefinition(fontId);
  switch (font.preferredTextCoverageMode) {
    case 'fill':
      return 'Fill default';
    case 'outline-fill':
      return 'Outline + fill default';
    default:
      return font.supportedTextCoverageModes.includes('fill') ? 'Outline default' : 'Outline only';
  }
}

export default function FontPicker({ value, previewText, onChange, status }: FontPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const fonts = useMemo(() => listOutlineFonts(), []);
  const selectedFont = getOutlineFontDefinition(value);
  const safePreviewText = previewText.trim() || 'Sulay 2026 ÅÄÖ';
  const selectedIndex = Math.max(0, fonts.findIndex((font) => font.fontId === value));

  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => optionRefs.current[selectedIndex]?.focus());
  }, [open, selectedIndex]);

  const openPicker = () => {
    setActiveIndex(selectedIndex);
    setOpen(true);
  };

  const handleSelect = (fontId: string) => {
    onChange(fontId);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const handleButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker();
    }
  };

  const handleListKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = (activeIndex + 1) % fonts.length;
      setActiveIndex(next);
      optionRefs.current[next]?.focus();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const next = (activeIndex - 1 + fonts.length) % fonts.length;
      setActiveIndex(next);
      optionRefs.current[next]?.focus();
      return;
    }
  };

  return (
    <div className="space-y-2">
      <style dangerouslySetInnerHTML={{ __html: getOutlineFontFaceCss() }} />
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-secondary">Font</span>
        <div className="flex items-center gap-2 text-[11px] text-ink-muted">
          <span>{selectedFont.category}</span>
          <span className="rounded-full border border-border px-2 py-0.5 uppercase tracking-wide">
            {getFontPolicyLabel(selectedFont.fontId)}
          </span>
        </div>
      </div>
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Choose outline font"
          onClick={() => (open ? setOpen(false) : openPicker())}
          onKeyDown={handleButtonKeyDown}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-surface-sunken px-3 py-3 text-left text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent-400"
        >
          <div className="min-w-0">
            <p className="font-medium">{selectedFont.displayName}</p>
            <p className="mt-1 truncate text-xs text-ink-muted" style={{ fontFamily: selectedFont.previewFontFamily }}>
              {safePreviewText}
            </p>
          </div>
          <ChevronDown className={`h-4 w-4 shrink-0 text-ink-muted transition ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <ul
            role="listbox"
            aria-label="Outline font options"
            tabIndex={-1}
            onKeyDown={handleListKeyDown}
            className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 max-h-80 overflow-y-auto rounded-2xl border border-border bg-surface-sunken p-2 shadow-2xl"
          >
            {fonts.map((font, index) => {
              const selected = font.fontId === value;
              return (
                <li key={font.fontId}>
                  <button
                    ref={(node) => { optionRefs.current[index] = node; }}
                    role="option"
                    aria-selected={selected}
                    onClick={() => handleSelect(font.fontId)}
                    className={`flex w-full items-start justify-between rounded-xl px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${selected ? 'bg-accent-50 text-ink' : 'text-ink-secondary hover:bg-surface-raised'}`}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{font.displayName}</span>
                        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-muted">{font.category}</span>
                        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-muted">{getFontPolicyLabel(font.fontId)}</span>
                      </div>
                      <p className="mt-2 truncate text-lg leading-tight" style={{ fontFamily: font.previewFontFamily }}>
                        {safePreviewText}
                      </p>
                    </div>
                    {selected ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" /> : <Type className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {status.status === 'loading' && status.fontId === value && (
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>{status.message ?? 'Loading font geometry…'}</span>
        </div>
      )}
      {status.status === 'error' && status.fontId === value && status.message && (
        <p className="text-xs text-danger-600">{status.message}</p>
      )}
    </div>
  );
}
