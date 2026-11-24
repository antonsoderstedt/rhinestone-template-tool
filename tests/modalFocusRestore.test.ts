/** @vitest-environment jsdom */

import { createElement, useState } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import EditorDialog from '../app/editor/EditorDialog';

afterEach(cleanup);

describe('shared EditorDialog focus restore', () => {
  it('returns focus to the Export trigger after Escape', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return createElement(
        'div',
        null,
        createElement(
          'button',
          { type: 'button', 'aria-label': 'Export', onClick: () => setOpen(true) },
          'Export',
        ),
        createElement(EditorDialog, {
          open,
          title: 'Fix errors before export',
          description: 'Resolve the blocking issues.',
          confirmLabel: 'Review issues',
          onConfirm: () => setOpen(false),
          onCancel: () => setOpen(false),
        }),
      );
    }

    const { getByRole } = render(createElement(Harness));
    const trigger = getByRole('button', { name: 'Export' }) as HTMLButtonElement;
    trigger.focus();
    fireEvent.click(trigger);

    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(document.activeElement).toBe(trigger);
  });

  it('returns focus to the trigger after Cancel', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return createElement(
        'div',
        null,
        createElement(
          'button',
          { type: 'button', 'aria-label': 'Open export dialog', onClick: () => setOpen(true) },
          'Open',
        ),
        createElement(EditorDialog, {
          open,
          title: 'Export with warnings?',
          description: 'Continue with warnings.',
          confirmLabel: 'Export anyway',
          cancelLabel: 'Cancel',
          onConfirm: () => setOpen(false),
          onCancel: () => setOpen(false),
        }),
      );
    }

    const { getByRole } = render(createElement(Harness));
    const trigger = getByRole('button', { name: 'Open export dialog' }) as HTMLButtonElement;
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(getByRole('button', { name: 'Cancel' }));

    expect(document.activeElement).toBe(trigger);
  });
});
