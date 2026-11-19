/** @vitest-environment jsdom */

import { createElement } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PromptDialog, { validatePromptName } from '../app/components/PromptDialog';
import UndoToast, { UNDO_TOAST_DURATION_MS } from '../app/components/UndoToast';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('validatePromptName', () => {
  it('requires a non-empty name of at most 80 characters', () => {
    expect(validatePromptName('')).toMatch(/Enter a name/);
    expect(validatePromptName('   ')).toMatch(/Enter a name/);
    expect(validatePromptName('x'.repeat(81))).toMatch(/80 characters/);
    expect(validatePromptName('  My design  ')).toBeNull();
  });
});

describe('PromptDialog', () => {
  function renderPrompt(overrides: Partial<Parameters<typeof PromptDialog>[0]> = {}) {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    render(
      createElement(PromptDialog, {
        open: true,
        title: 'Rename design',
        label: 'Design name',
        initialValue: 'Old name',
        onSubmit,
        onCancel,
        ...overrides,
      }),
    );
    return { onSubmit, onCancel };
  }

  const input = () => document.querySelector('input[type="text"]') as HTMLInputElement;
  const form = () => document.querySelector('form') as HTMLFormElement;

  it('is a labelled, modal dialog prefilled with the current name', () => {
    renderPrompt();
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBeTruthy();
    expect(input().value).toBe('Old name');
    expect(document.body.textContent).toContain('Design name');
  });

  it('puts keyboard focus in the name field with the current name selected', async () => {
    renderPrompt();
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });
    expect(document.activeElement).toBe(input());
    expect(input().selectionStart).toBe(0);
    expect(input().selectionEnd).toBe('Old name'.length);
  });

  it('submits the trimmed value (Enter submits the form)', () => {
    const { onSubmit } = renderPrompt();
    fireEvent.change(input(), { target: { value: '  New name  ' } });
    fireEvent.submit(form());
    expect(onSubmit).toHaveBeenCalledWith('New name');
  });

  it('blocks an empty name and shows an error instead of submitting', () => {
    const { onSubmit } = renderPrompt();
    fireEvent.change(input(), { target: { value: '   ' } });
    fireEvent.submit(form());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]')?.textContent).toMatch(/Enter a name/);
    expect(input().getAttribute('aria-invalid')).toBe('true');
  });

  it('cancels on the Cancel button and on Escape without submitting', () => {
    const { onSubmit, onCancel } = renderPrompt();
    const cancel = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Cancel');
    fireEvent.click(cancel!);
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('renders nothing while closed', () => {
    renderPrompt({ open: false });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});

describe('UndoToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('renders nothing without a message', () => {
    render(createElement(UndoToast, { message: null, toastId: 0, onUndo: vi.fn(), onDismiss: vi.fn() }));
    expect(document.querySelector('[role="status"]')).toBeNull();
  });

  it('shows the message with an Undo button that calls onUndo', () => {
    const onUndo = vi.fn();
    render(createElement(UndoToast, { message: 'Deleted “Heart”.', toastId: 1, onUndo, onDismiss: vi.fn() }));
    expect(document.querySelector('[role="status"]')?.textContent).toContain('Deleted “Heart”.');
    fireEvent.click([...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Undo'))!);
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('dismisses itself after the countdown and restarts it for a new deletion', () => {
    const onDismiss = vi.fn();
    const { rerender } = render(createElement(UndoToast, { message: 'one', toastId: 1, onUndo: vi.fn(), onDismiss }));

    act(() => {
      vi.advanceTimersByTime(UNDO_TOAST_DURATION_MS - 1000);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    // A second deletion restarts the timer instead of cutting the new toast short.
    rerender(createElement(UndoToast, { message: 'two', toastId: 2, onUndo: vi.fn(), onDismiss }));
    act(() => {
      vi.advanceTimersByTime(UNDO_TOAST_DURATION_MS - 1000);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
