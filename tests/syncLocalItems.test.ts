import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyRemoteItem, decodeSyncId, deleteLocalItem, encodeSyncId, hashText, listLocalItems as listAll, readLocalItemData } from '../app/lib/sync/localItems';
import { DEFAULT_WORKSPACE_SETTINGS } from '../app/lib/workspaceSettings';
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

/** The settings are always listed; most tests are about the saved things. */
const listLocalItems = () => listAll().filter((item) => item.kind !== 'settings');

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

describe('settings and choices (items without a change time)', () => {
  beforeEach(() => void vi.stubGlobal('localStorage', memoryStorage()));
  afterEach(() => void vi.unstubAllGlobals());

  const settingsItem = () => listAll().find((item) => item.kind === 'settings' && item.id === 'workspace')!;
  const withVault = (patch: Partial<typeof EMPTY_WORKSPACE_VAULT>) => writeWorkspaceVault({ ...readWorkspaceVault(), ...patch });

  it('gives untouched default settings the time "never", so a new device takes the server\'s settings instead of overwriting them', () => {
    expect(settingsItem().updatedAt).toBe('1970-01-01T00:00:00.000Z');
  });

  it('notices a change in the settings and gives it the time it was noticed, and keeps that time while nothing changes', () => {
    const vault = readWorkspaceVault();
    withVault({ settings: { ...vault.settings, defaultStoneSize: 'SS16' } });
    const first = settingsItem().updatedAt;
    expect(Date.parse(first)).toBeGreaterThan(Date.parse('2020-01-01'));
    expect(settingsItem().updatedAt).toBe(first);
    withVault({ settings: { ...readWorkspaceVault().settings, htvWeedMarginMm: 9 } });
    expect(Date.parse(settingsItem().updatedAt)).toBeGreaterThanOrEqual(Date.parse(first));
    expect(JSON.parse(readLocalItemData('settings', 'workspace')!).htvWeedMarginMm).toBe(9);
  });

  it('takes settings from the server, checked and filled in, and does not send them straight back as a change', () => {
    const remote = { ...DEFAULT_WORKSPACE_SETTINGS, defaultStoneSize: 'SS6', htvWeedMarginMm: 12, bogus: 1 };
    expect(applyRemoteItem('settings', 'workspace', JSON.stringify(remote), '2026-11-24T12:00:00.000Z')).toBe(true);
    expect(readWorkspaceVault().settings).toMatchObject({ defaultStoneSize: 'SS6', htvWeedMarginMm: 12 });
    expect(settingsItem().updatedAt).toBe('2026-11-24T12:00:00.000Z');
  });

  it('syncs favourites, tags and archived designs one by one, whatever characters their keys have', () => {
    withVault({
      fontPreferences: [{ fontKey: 'installed-acelon-regular-imported-2', tags: ['wedding'], favorite: true, archived: false }],
      designPreferences: [{ designKey: 'rhinestone:my design/1', archived: true }],
    });
    const items = listAll();
    expect(items.map((i) => `${i.kind}:${i.id}`)).toEqual(expect.arrayContaining([
      'fontpref:installed-acelon-regular-imported-2',
      `designpref:${encodeSyncId('rhinestone:my design/1')}`,
    ]));
    expect(encodeSyncId('rhinestone:my design/1')).toMatch(/^[A-Za-z0-9._:~-]+$/);
    expect(decodeSyncId(encodeSyncId('a b/c~d'))).toBe('a b/c~d');

    // The same choices arrive on another device.
    const sent = items.filter((i) => i.kind === 'fontpref' || i.kind === 'designpref').map((i) => ({ i, data: readLocalItemData(i.kind, i.id)! }));
    vi.stubGlobal('localStorage', memoryStorage());
    for (const { i, data } of sent) expect(applyRemoteItem(i.kind, i.id, data, '2026-11-24T10:00:00.000Z')).toBe(true);
    expect(readWorkspaceVault().fontPreferences).toEqual([{ fontKey: 'installed-acelon-regular-imported-2', tags: ['wedding'], favorite: true, archived: false }]);
    expect(readWorkspaceVault().designPreferences).toEqual([{ designKey: 'rhinestone:my design/1', archived: true }]);
  });

  it('removes a choice that was removed elsewhere, and only that one', () => {
    withVault({ fontPreferences: [{ fontKey: 'a', tags: [], favorite: true, archived: false }, { fontKey: 'b', tags: [], favorite: true, archived: false }] });
    expect(deleteLocalItem('fontpref', 'a')).toBe(true);
    expect(readWorkspaceVault().fontPreferences.map((p) => p.fontKey)).toEqual(['b']);
  });

  it('syncs the active calibration profile, and clears it when it was cleared elsewhere', () => {
    expect(listAll().some((i) => i.id === 'active-calibration')).toBe(false);
    expect(applyRemoteItem('settings', 'active-calibration', JSON.stringify({ profileId: 'cal-1' }), '2026-11-24T10:00:00.000Z')).toBe(true);
    expect(localStorage.getItem('rhinestone-active-calibration-profile')).toBe('cal-1');
    expect(listAll().find((i) => i.id === 'active-calibration')!.updatedAt).toBe('2026-11-24T10:00:00.000Z');
    expect(deleteLocalItem('settings', 'active-calibration')).toBe(true);
    expect(localStorage.getItem('rhinestone-active-calibration-profile')).toBeNull();
  });

  it('syncs the fonts the user uploaded, but never the library fonts', () => {
    const upload = { fontId: 'upload-font-1', name: 'Mine', fileName: 'mine.ttf', mimeType: 'font/ttf', sizeBytes: 10, sourceKind: 'browser-uploaded', category: 'Display', styleLabel: '', tags: [], favorite: false, archived: false, createdAt: '2026-11-24T09:00:00.000Z', updatedAt: '2026-11-24T09:00:00.000Z', previewFamily: 'X', previewText: '', licenseSource: '', note: '', preferredTextCoverageMode: 'outline', supportedTextCoverageModes: ['outline'], sourceDataUrl: 'data:font/ttf;base64,AAAA' };
    expect(applyRemoteItem('font', 'upload-font-1', JSON.stringify(upload))).toBe(true);
    expect(listAll().some((i) => i.kind === 'font' && i.id === 'upload-font-1')).toBe(true);
    expect(applyRemoteItem('font', 'x', JSON.stringify({ ...upload, fontId: 'x', sourceKind: 'workspace-installed' }))).toBe(false);
  });

  it('refuses choices that are not what they claim to be', () => {
    expect(applyRemoteItem('fontpref', 'a', JSON.stringify({ fontKey: 'b', tags: [], favorite: true, archived: false }))).toBe(false);
    expect(applyRemoteItem('fontpref', 'a', JSON.stringify({ fontKey: 'a', tags: 'x', favorite: true, archived: false }))).toBe(false);
    expect(applyRemoteItem('designpref', 'a', JSON.stringify({ designKey: 'a', archived: 'yes' }))).toBe(false);
    expect(applyRemoteItem('settings', 'other', '{}')).toBe(false);
    expect(hashText('a')).not.toBe(hashText('b'));
  });

  it('syncs the language and the length unit, but only when the user has chosen one (the default is not a choice)', () => {
    expect(listAll().some((i) => i.id === 'language' || i.id === 'unit')).toBe(false);
    localStorage.setItem('rt-language', 'sv');
    localStorage.setItem('rt-unit', 'in');
    const items = listAll().filter((i) => i.id === 'language' || i.id === 'unit');
    expect(items.map((i) => i.id).sort()).toEqual(['language', 'unit']);
    expect(JSON.parse(readLocalItemData('settings', 'language')!)).toEqual({ value: 'sv' });

    // Another device that has chosen nothing takes both.
    vi.stubGlobal('localStorage', memoryStorage());
    expect(applyRemoteItem('settings', 'language', JSON.stringify({ value: 'sv' }), '2026-11-24T10:00:00.000Z')).toBe(true);
    expect(applyRemoteItem('settings', 'unit', JSON.stringify({ value: 'in' }), '2026-11-24T10:00:00.000Z')).toBe(true);
    expect(localStorage.getItem('rt-language')).toBe('sv');
    expect(localStorage.getItem('rt-unit')).toBe('in');
    // ...and does not send them straight back as changes.
    expect(listAll().find((i) => i.id === 'language')!.updatedAt).toBe('2026-11-24T10:00:00.000Z');
  });

  it('notices a changed language, and refuses values that are not a language or a unit', () => {
    localStorage.setItem('rt-language', 'en');
    const first = listAll().find((i) => i.id === 'language')!.updatedAt;
    localStorage.setItem('rt-language', 'sv');
    expect(Date.parse(listAll().find((i) => i.id === 'language')!.updatedAt)).toBeGreaterThanOrEqual(Date.parse(first));
    expect(JSON.parse(readLocalItemData('settings', 'language')!).value).toBe('sv');
    expect(applyRemoteItem('settings', 'language', JSON.stringify({ value: 'fr' }))).toBe(false);
    expect(applyRemoteItem('settings', 'unit', JSON.stringify({ value: 'cm' }))).toBe(false);
    expect(localStorage.getItem('rt-language')).toBe('sv');
  });

  it('never deletes a language or unit choice because of a deletion elsewhere', () => {
    localStorage.setItem('rt-language', 'sv');
    expect(deleteLocalItem('settings', 'language')).toBe(true);
    expect(localStorage.getItem('rt-language')).toBe('sv');
  });
});
