import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyRemoteItem, deleteLocalItem, listLocalItems, readLocalItemData } from '../app/lib/sync/localItems';
import { readWorkspaceVault, writeWorkspaceVault, EMPTY_WORKSPACE_VAULT } from '../app/lib/workspaceVault';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() { return data.size; },
  };
}

const TEMPLATE = { templateId: 't1', name: 'Heart', updatedAt: '2026-11-24T10:00:00.000Z', builtIn: false, readOnly: false, snapshot: { version: 1, project: {} } };
const ASSET = { assetId: 'a1', name: 'Logo', fileName: 'logo.svg', kind: 'svg', mimeType: 'image/svg+xml', sizeBytes: 10, tags: [], favorite: false, archived: false, createdAt: '2026-11-24T09:00:00.000Z', updatedAt: '2026-11-24T09:00:00.000Z', previewDataUrl: '', sourceDataUrl: '', svgText: '<svg/>' };

describe('local items for sync', () => {
  beforeEach(() => void vi.stubGlobal('localStorage', memoryStorage()));
  afterEach(() => void vi.unstubAllGlobals());

  it('starts empty', () => {
    expect(listLocalItems()).toEqual([]);
  });

  it('takes a template from another device and hands it back unchanged', () => {
    expect(applyRemoteItem('template', 't1', JSON.stringify(TEMPLATE))).toBe(true);
    expect(listLocalItems()).toEqual([{ kind: 'template', id: 't1', updatedAt: TEMPLATE.updatedAt }]);
    expect(JSON.parse(readLocalItemData('template', 't1')!)).toEqual(TEMPLATE);
  });

  it('replaces an item with the same id instead of adding a second one', () => {
    applyRemoteItem('template', 't1', JSON.stringify(TEMPLATE));
    applyRemoteItem('template', 't1', JSON.stringify({ ...TEMPLATE, name: 'Heart 2', updatedAt: '2026-11-24T11:00:00.000Z' }));
    expect(listLocalItems()).toHaveLength(1);
    expect(JSON.parse(readLocalItemData('template', 't1')!).name).toBe('Heart 2');
  });

  it('keeps vault items (files) and the rest of the vault apart from templates', () => {
    writeWorkspaceVault({ ...EMPTY_WORKSPACE_VAULT, settings: { ...EMPTY_WORKSPACE_VAULT.settings } });
    expect(applyRemoteItem('asset', 'a1', JSON.stringify(ASSET))).toBe(true);
    expect(readWorkspaceVault().assets.map((asset) => asset.assetId)).toEqual(['a1']);
    expect(listLocalItems().map((item) => `${item.kind}:${item.id}`)).toEqual(['asset:a1']);
  });

  it('deletes by kind and id, and only that one', () => {
    applyRemoteItem('template', 't1', JSON.stringify(TEMPLATE));
    applyRemoteItem('asset', 'a1', JSON.stringify(ASSET));
    expect(deleteLocalItem('template', 't1')).toBe(true);
    expect(listLocalItems().map((item) => item.kind)).toEqual(['asset']);
  });

  it('refuses data that is not the item it claims to be', () => {
    expect(applyRemoteItem('template', 't2', JSON.stringify(TEMPLATE))).toBe(false); // wrong id
    expect(applyRemoteItem('template', 't1', 'not json')).toBe(false);
    expect(applyRemoteItem('template', 't1', JSON.stringify({ ...TEMPLATE, builtIn: true }))).toBe(false); // starters are never synced
    expect(applyRemoteItem('asset', 'a1', JSON.stringify([]))).toBe(false);
    expect(listLocalItems()).toEqual([]);
  });

  it('does not list built-in templates', () => {
    localStorage.setItem('rhinestone-template-library', JSON.stringify({ version: 1, builtInTemplates: [], userTemplates: [{ ...TEMPLATE, templateId: 'starter', builtIn: true, readOnly: true }, TEMPLATE] }));
    expect(listLocalItems().map((item) => item.id)).toEqual(['t1']);
  });
});
