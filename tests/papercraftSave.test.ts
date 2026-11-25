import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shapes } from '../src/lib/papercraft-engine';
import { bootPapercraft } from '../app/papercraft/papercraftBoot';
import { PAPERCRAFT_DRAFT_KEY, readPapercraftDraft, writePapercraftDraft } from '../app/papercraft/papercraftDraft';
import { buildPapercraftShareLink, readSharedPapercraft } from '../app/papercraft/papercraftShare';
import { canSavePapercraft, deserializePapercraft, MAX_SAVED_FACES, MAX_SAVED_POSITION_NUMBERS, serializePapercraft, snapshotText } from '../app/papercraft/papercraftSnapshot';
import { initialPapercraftState, papercraftReducer, type PapercraftState } from '../app/papercraft/papercraftState';
import { savedDesignThumbnail } from '../app/papercraft/papercraftThumbnail';
import { addPapercraftVersion, MAX_PAPERCRAFT_VERSIONS, readPapercraftVersions, recordPapercraftVersion, removePapercraftVersions, writePapercraftVersions } from '../app/papercraft/papercraftVersions';
import { buildRecentDesigns } from '../app/lib/recentDesigns';
import { applyRemoteItem, deleteLocalItem, listLocalItems as listAll, readLocalItemData } from '../app/lib/sync/localItems';
import { isKnownKind, KNOWN_KINDS } from '../app/lib/sync/syncPlan';
import { createWorkspaceBackup, describeMergeSummary, mergeWorkspaceBackup, parseWorkspaceBackup, serializeWorkspaceBackup } from '../app/lib/workspaceBackup';
import { buildPapercraftDesignEntry, EMPTY_WORKSPACE_VAULT, isPapercraftEntry, readWorkspaceVault, writeWorkspaceVault } from '../app/lib/workspaceVault';
import { SYNC_KINDS } from '../worker/sync';

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

const fileState = (): PapercraftState =>
  papercraftReducer(initialPapercraftState(), { type: 'USE_FILE', fileName: 'my box.obj', mesh: shapes.cube(0.123456789123) });

describe('a saved papercraft design', () => {
  it('a built-in model is saved as just its id, with the settings and hand edits', () => {
    let s = initialPapercraftState();
    s = papercraftReducer(s, { type: 'USE_BUILT_IN', id: 'dodecahedron' });
    s = papercraftReducer(s, { type: 'SET_PATTERN', pattern: { tabWidthMm: 11, printedSide: 'inside' } });
    s = papercraftReducer(s, { type: 'TOGGLE_EDGE', edgeId: 4, joined: true });
    const snap = serializePapercraft(s);
    expect(snap.source).toEqual({ kind: 'builtin', id: 'dodecahedron' });
    expect(snap.edits.forceCut).toEqual([4]);
    const back = deserializePapercraft(JSON.parse(JSON.stringify(snap)));
    expect(back).not.toBeNull();
    expect(back!.pattern.tabWidthMm).toBe(11);
    expect(back!.pattern.printedSide).toBe('inside');
    expect(back!.edits).toEqual({ forceCut: [4], forceJoin: [] });
    expect(back!.source).toEqual({ kind: 'builtin', id: 'dodecahedron' });
  });

  it('keeps the view, the selection and the fold amount out of the design', () => {
    const a = papercraftReducer(papercraftReducer(initialPapercraftState(), { type: 'SET_VIEW', view: 'model' }), { type: 'SET_FOLD', fold: 0.2 });
    expect(snapshotText(a)).toBe(snapshotText(initialPapercraftState()));
    const back = deserializePapercraft(serializePapercraft(a))!;
    expect(back.view).toBe('pattern');
    expect(back.fold).toBe(1);
    expect(back.selectedPartId).toBeNull();
  });

  it('an imported model comes back with the same shape (numbers to seven digits)', () => {
    const s = fileState();
    const back = deserializePapercraft(JSON.parse(snapshotText(s)))!;
    expect(back.source.kind).toBe('file');
    if (back.source.kind !== 'file' || s.source.kind !== 'file') throw new Error('file expected');
    expect(back.source.fileName).toBe('my box.obj');
    expect(back.source.mesh.faces).toEqual(s.source.mesh.faces);
    back.source.mesh.positions.forEach((p, i) => p.forEach((v, k) => expect(v).toBeCloseTo(s.source.kind === 'file' ? s.source.mesh.positions[i][k] : 0, 8)));
  });

  it('rejects what is not a design, and what names a model that does not exist', () => {
    const good = JSON.parse(snapshotText(initialPapercraftState()));
    expect(deserializePapercraft(good)).not.toBeNull();
    for (const bad of [null, 'x', [], {}, { ...good, version: 2 }, { ...good, source: { kind: 'builtin', id: 'nope' } }, { ...good, source: { kind: 'other' } }, { ...good, size: { by: 'weight', mm: 5 } }, { ...good, size: { by: 'height', mm: -1 } }, { ...good, size: { by: 'height', mm: 'a' } }, { ...good, paper: { ...good.paper, preset: 'a0' } }, { ...good, pattern: { ...good.pattern, printedSide: 'left' } }, { ...good, cover: 'yes' }, { ...good, edits: { forceCut: [-1], forceJoin: [] } }, { ...good, edits: { forceCut: [1.5], forceJoin: [] } }, { ...good, projectName: 5 }]) {
      expect(deserializePapercraft(bad), JSON.stringify(bad).slice(0, 80)).toBeNull();
    }
  });

  it('rejects a damaged mesh: wrong lengths, indices out of range, too few corners, not numbers', () => {
    const base = JSON.parse(snapshotText(fileState()));
    const withMesh = (mesh: unknown) => ({ ...base, source: { kind: 'file', fileName: 'x.obj', mesh } });
    const ok = base.source.mesh;
    expect(deserializePapercraft(withMesh(ok))).not.toBeNull();
    for (const mesh of [null, {}, { positions: [1, 2], faces: [[0, 1, 2]] }, { ...ok, positions: ok.positions.slice(0, 7) }, { ...ok, faces: [[0, 1, 99]] }, { ...ok, faces: [[0, 1]] }, { ...ok, faces: [] }, { positions: [], faces: [[0, 1, 2]] }, { ...ok, positions: [...ok.positions.slice(0, 23), 'x'] }, { ...ok, faces: [[0, 1, 1.5]] }]) {
      expect(deserializePapercraft(withMesh(mesh))).toBeNull();
    }
  });

  it('brings numbers out of range into range instead of refusing the design', () => {
    const good = JSON.parse(snapshotText(initialPapercraftState()));
    const back = deserializePapercraft({ ...good, size: { by: 'largest', mm: 9e9 }, paper: { ...good.paper, marginMm: 500, gapMm: -5 }, pattern: { ...good.pattern, tabWidthMm: 0, tabAngleDeg: 999, numberHeightMm: 99 } })!;
    expect(back.size.mm).toBe(100_000);
    expect(back.paper.marginMm).toBe(50);
    expect(back.paper.gapMm).toBe(0);
    expect(back.pattern.tabWidthMm).toBe(3);
    expect(back.pattern.tabAngleDeg).toBe(90);
    expect(back.pattern.numberHeightMm).toBe(15);
  });

  it('refuses to save a model that is too big for the browser', () => {
    expect(canSavePapercraft(initialPapercraftState())).toBe(true);
    expect(canSavePapercraft(fileState())).toBe(true);
    const faces = Array.from({ length: MAX_SAVED_FACES + 1 }, () => [0, 1, 2]);
    const many = papercraftReducer(initialPapercraftState(), { type: 'USE_FILE', fileName: 'big.obj', mesh: { positions: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], faces } });
    expect(canSavePapercraft(many)).toBe(false);
    const positions = Array.from({ length: MAX_SAVED_POSITION_NUMBERS / 3 + 10 }, (): [number, number, number] => [0, 0, 0]);
    expect(canSavePapercraft(papercraftReducer(initialPapercraftState(), { type: 'USE_FILE', fileName: 'big.obj', mesh: { positions, faces: [[0, 1, 2]] } }))).toBe(false);
  });

  it('loading a design replaces everything but keeps the view you are in', () => {
    const open = papercraftReducer(initialPapercraftState(), { type: 'SET_VIEW', view: 'pages' });
    const loaded = papercraftReducer(open, { type: 'LOAD_STATE', state: { ...initialPapercraftState(), projectName: 'Other', view: 'model', fold: 0.1, selectedPartId: 3 } });
    expect(loaded.projectName).toBe('Other');
    expect(loaded.view).toBe('pages');
    expect(loaded.fold).toBe(1);
    expect(loaded.selectedPartId).toBeNull();
  });
});

describe('the vault', () => {
  beforeEach(() => void vi.stubGlobal('localStorage', memoryStorage()));
  afterEach(() => void vi.unstubAllGlobals());

  it('builds an entry with the model and size as words, keeps the id, tags and creation time when saving again', () => {
    const first = buildPapercraftDesignEntry(initialPapercraftState());
    expect(first.sourceLabel).toBe('Test cube');
    expect(first.sizeLabel).toBe('40 mm (longest side)');
    expect(first.name).toBe('Test cube');
    expect(isPapercraftEntry(first)).toBe(true);
    const again = buildPapercraftDesignEntry({ ...initialPapercraftState(), projectName: 'Renamed' }, { ...first, tags: ['gift'], favorite: true });
    expect(again.designId).toBe(first.designId);
    expect(again.createdAt).toBe(first.createdAt);
    expect(again.tags).toEqual(['gift']);
    expect(again.favorite).toBe(true);
    expect(again.name).toBe('Renamed');
    expect(buildPapercraftDesignEntry(fileState()).sourceLabel).toBe('my box.obj');
  });

  it('stores designs and drops entries it cannot open when the vault is read', () => {
    const entry = buildPapercraftDesignEntry(initialPapercraftState());
    const broken = { ...entry, designId: 'broken', snapshot: { ...entry.snapshot, source: { kind: 'builtin', id: 'gone' } } };
    window_setItem('rhinestone-workspace-vault', JSON.stringify({ ...EMPTY_WORKSPACE_VAULT, papercraftDesigns: [entry, broken, 5, null] }));
    expect(readWorkspaceVault().papercraftDesigns.map((d) => d.designId)).toEqual([entry.designId]);
  });

  it('a vault from before the Papercraft studio has an empty list', () => {
    const old: Record<string, unknown> = { ...EMPTY_WORKSPACE_VAULT };
    delete old.papercraftDesigns;
    window_setItem('rhinestone-workspace-vault', JSON.stringify(old));
    expect(readWorkspaceVault().papercraftDesigns).toEqual([]);
  });
});

/** The vault's storage key is internal to the module: it is written through the module itself. */
function window_setItem(_key: string, value: string) {
  writeWorkspaceVault(JSON.parse(value));
}

describe('opening the studio', () => {
  const entry = buildPapercraftDesignEntry({ ...initialPapercraftState(), projectName: 'Saved fox' });
  const vault = { papercraftDesigns: [entry] };
  const draftState = papercraftReducer(initialPapercraftState(), { type: 'USE_BUILT_IN', id: 'swan' });

  it('opens the design named in the address', () => {
    const boot = bootPapercraft(`?designId=${entry.designId}`, vault, null);
    expect(boot.from).toBe('design');
    expect(boot.activeId).toBe(entry.designId);
    expect(boot.state.projectName).toBe('Saved fox');
  });

  it('a design that is not there opens the test cube and says so; the address wins over a draft', () => {
    const missing = bootPapercraft('?designId=nope', vault, { activeId: null, snapshotText: snapshotText(draftState) });
    expect(missing.from).toBe('missing-design');
    expect(missing.activeId).toBeNull();
    expect(missing.state.source).toEqual({ kind: 'builtin', id: 'test-cube' });
    expect(bootPapercraft(`?designId=${entry.designId}`, vault, { activeId: null, snapshotText: snapshotText(draftState) }).from).toBe('design');
  });

  it('carries on with the draft from the last visit, as the saved design it was only while that design exists', () => {
    const draft = { activeId: entry.designId, snapshotText: snapshotText(draftState) };
    const boot = bootPapercraft('', vault, draft);
    expect(boot.from).toBe('draft');
    expect(boot.state.source).toEqual({ kind: 'builtin', id: 'swan' });
    expect(boot.activeId).toBe(entry.designId);
    expect(bootPapercraft('', { papercraftDesigns: [] }, draft).activeId).toBeNull();
  });

  it('opens the test cube when there is nothing, or when the draft is damaged', () => {
    expect(bootPapercraft('', vault, null).from).toBe('new');
    expect(bootPapercraft('', vault, { activeId: null, snapshotText: '{oops' }).from).toBe('new');
    expect(bootPapercraft('', vault, { activeId: null, snapshotText: '{"version":1}' }).from).toBe('new');
    expect(bootPapercraft('?foo=1', vault, null).state.projectName).toBe('Test cube');
  });
});

describe('the draft', () => {
  beforeEach(() => void vi.stubGlobal('localStorage', memoryStorage()));
  afterEach(() => void vi.unstubAllGlobals());

  it('is written and read back, and is nothing when damaged', () => {
    expect(readPapercraftDraft()).toBeNull();
    expect(writePapercraftDraft({ activeId: 'p1', snapshotText: 'abc' })).toBe(true);
    expect(readPapercraftDraft()).toEqual({ activeId: 'p1', snapshotText: 'abc' });
    localStorage.setItem(PAPERCRAFT_DRAFT_KEY, '{bad');
    expect(readPapercraftDraft()).toBeNull();
    localStorage.setItem(PAPERCRAFT_DRAFT_KEY, JSON.stringify({ activeId: 5, snapshotText: 'x' }));
    expect(readPapercraftDraft()).toBeNull();
  });
});

describe('earlier versions', () => {
  const v = (n: number, text = `design ${n}`) => ({ savedAt: `2026-11-2${n}T10:00:00.000Z`, name: 'x', snapshotText: text });

  it('keeps the newest first, drops a copy of the latest and a version that is too big, and keeps only five', () => {
    let list = addPapercraftVersion([], v(1));
    expect(list.kept).toBe(true);
    expect(addPapercraftVersion(list.versions, v(2, 'design 1')).kept).toBe(false);
    expect(addPapercraftVersion([], v(1, 'x'.repeat(200_001))).kept).toBe(false);
    for (let i = 2; i <= 8; i++) list = addPapercraftVersion(list.versions, v(i % 9));
    expect(list.versions).toHaveLength(MAX_PAPERCRAFT_VERSIONS);
    expect(list.versions[0].snapshotText).toBe('design 8');
  });

  it('is kept per design in storage, and removed with the design', () => {
    const storage = memoryStorage();
    recordPapercraftVersion(storage, 'p1', v(1));
    recordPapercraftVersion(storage, 'p1', v(2));
    recordPapercraftVersion(storage, 'p2', v(3));
    expect(readPapercraftVersions(storage, 'p1').map((x) => x.snapshotText)).toEqual(['design 2', 'design 1']);
    expect(readPapercraftVersions(storage, 'p2')).toHaveLength(1);
    removePapercraftVersions(storage, 'p1');
    expect(readPapercraftVersions(storage, 'p1')).toEqual([]);
  });

  it('reads nothing from damaged storage, and a full storage only stops the history growing', () => {
    const storage = memoryStorage();
    storage.setItem('rhinestone-papercraft-versions:p1', '{bad');
    expect(readPapercraftVersions(storage, 'p1')).toEqual([]);
    storage.setItem('rhinestone-papercraft-versions:p1', JSON.stringify([{ savedAt: 1 }, v(1)]));
    expect(readPapercraftVersions(storage, 'p1')).toHaveLength(1);
    const full = { setItem: () => { throw new Error('quota'); }, removeItem: () => undefined };
    expect(writePapercraftVersions(full, 'p1', [v(1)])).toBe(false);
  });
});

describe('a link to a design', () => {
  it('carries the whole design in the address after #, and opens as the same design', async () => {
    const state = papercraftReducer(initialPapercraftState(), { type: 'USE_BUILT_IN', id: 'fish' });
    const result = await buildPapercraftShareLink(state, 'https://studio.example');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url.startsWith('https://studio.example/papercraft#share=')).toBe(true);
    const hash = result.url.slice(result.url.indexOf('#'));
    const opened = await readSharedPapercraft(hash);
    expect(opened!.source).toEqual({ kind: 'builtin', id: 'fish' });
    expect(snapshotText(opened!)).toBe(snapshotText(state));
  });

  it('an imported model fits in a link when it is small, and says so when it is not', async () => {
    const small = await buildPapercraftShareLink(fileState(), 'https://x.example');
    expect(small.ok).toBe(true);
    // A dense scan: thousands of corners with numbers that do not repeat (a simple generator, so the test does not change from run to run).
    let seed = 12345;
    const next = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) * 100;
    const positions = Array.from({ length: 14000 }, (): [number, number, number] => [next(), next(), next()]);
    const faces = Array.from({ length: 6000 }, (_, i) => [i, i + 1, i + 2]);
    const scan = papercraftReducer(initialPapercraftState(), { type: 'USE_FILE', fileName: 's.obj', mesh: { positions, faces } });
    const big = await buildPapercraftShareLink(scan, 'https://x.example');
    expect(big.ok).toBe(false);
  });

  it('is null for an address that is not a share link, and throws a readable error for a damaged one or one from another tool', async () => {
    expect(await readSharedPapercraft('')).toBeNull();
    expect(await readSharedPapercraft('#other=abc')).toBeNull();
    expect(await readSharedPapercraft('#share=!!!')).toBeNull();
    await expect(readSharedPapercraft('#share=abcdef')).rejects.toThrow(/damaged|not a design/i);
    const { encodeSharePayload } = await import('../app/lib/shareLink');
    await expect(readSharedPapercraft(`#share=${await encodeSharePayload('{"not":"ours"}')}`)).rejects.toThrow(/Papercraft/);
    await expect(readSharedPapercraft(`#share=${await encodeSharePayload('not json')}`)).rejects.toThrow(/damaged/);
  });
});

describe('sync of saved models', () => {
  beforeEach(() => void vi.stubGlobal('localStorage', memoryStorage()));
  afterEach(() => void vi.unstubAllGlobals());
  const listItems = () => listAll().filter((i) => i.kind === 'papercraft');

  it('is a kind both the app and the server know', () => {
    expect(isKnownKind('papercraft')).toBe(true);
    expect(KNOWN_KINDS).toContain('papercraft');
    expect(SYNC_KINDS).toContain('papercraft');
  });

  it('lists a saved design, gives its data, takes one from another device and removes it', () => {
    const entry = buildPapercraftDesignEntry(initialPapercraftState());
    expect(applyRemoteItem('papercraft', entry.designId, JSON.stringify(entry))).toBe(true);
    expect(listItems()).toEqual([{ kind: 'papercraft', id: entry.designId, updatedAt: entry.updatedAt }]);
    expect(JSON.parse(readLocalItemData('papercraft', entry.designId)!)).toEqual(entry);
    const newer = { ...entry, name: 'Newer', updatedAt: '2099-01-01T00:00:00.000Z' };
    expect(applyRemoteItem('papercraft', entry.designId, JSON.stringify(newer))).toBe(true);
    expect(listItems()).toHaveLength(1);
    expect(readWorkspaceVault().papercraftDesigns[0].name).toBe('Newer');
    expect(deleteLocalItem('papercraft', entry.designId)).toBe(true);
    expect(listItems()).toEqual([]);
  });

  it('refuses data that is not a design it can open: wrong id, not json, a model that is not built in, a damaged mesh', () => {
    const entry = buildPapercraftDesignEntry(initialPapercraftState());
    expect(applyRemoteItem('papercraft', 'other-id', JSON.stringify(entry))).toBe(false);
    expect(applyRemoteItem('papercraft', entry.designId, 'not json')).toBe(false);
    expect(applyRemoteItem('papercraft', entry.designId, JSON.stringify({ ...entry, snapshot: { ...entry.snapshot, source: { kind: 'builtin', id: 'gone' } } }))).toBe(false);
    expect(applyRemoteItem('papercraft', entry.designId, JSON.stringify({ ...entry, snapshot: { ...entry.snapshot, source: { kind: 'file', fileName: 'x', mesh: { positions: [0, 0, 0], faces: [[0, 1, 2]] } } } }))).toBe(false);
    expect(listItems()).toEqual([]);
  });

  it('syncs an imported model with its mesh inside', () => {
    const entry = buildPapercraftDesignEntry(fileState());
    expect(applyRemoteItem('papercraft', entry.designId, JSON.stringify(entry))).toBe(true);
    const stored = readWorkspaceVault().papercraftDesigns[0];
    expect(deserializePapercraft(stored.snapshot)!.source.kind).toBe('file');
  });
});

describe('backup of saved models', () => {
  const entry = buildPapercraftDesignEntry({ ...initialPapercraftState(), projectName: 'Backed up' });
  const base = { rhinestoneDesigns: [], htvDesigns: [], createdAt: '2026-11-26T10:00:00.000Z' };

  it('puts saved models in the backup and reads them back', () => {
    const backup = createWorkspaceBackup({ ...base, papercraftDesigns: [entry] });
    const parsed = parseWorkspaceBackup(serializeWorkspaceBackup(backup));
    expect(parsed.skippedCount).toBe(0);
    expect(parsed.backup.papercraftDesigns?.map((d) => d.designId)).toEqual([entry.designId]);
  });

  it('a backup from before the Papercraft studio has none, and a damaged entry is skipped and counted', () => {
    const old = JSON.parse(serializeWorkspaceBackup(createWorkspaceBackup(base)));
    expect(old.papercraftDesigns).toBeUndefined();
    expect(parseWorkspaceBackup(JSON.stringify(old)).backup.papercraftDesigns).toBeUndefined();
    const damaged = { ...old, papercraftDesigns: [entry, { ...entry, designId: 'bad', snapshot: { version: 9 } }, 'x'] };
    const parsed = parseWorkspaceBackup(JSON.stringify(damaged));
    expect(parsed.backup.papercraftDesigns).toHaveLength(1);
    expect(parsed.skippedCount).toBe(2);
  });

  it('adds new ones, takes a newer copy, keeps a newer one that is here, and says what it did', () => {
    const backup = createWorkspaceBackup({ ...base, papercraftDesigns: [entry, { ...entry, designId: 'newer-in-backup', updatedAt: '2099-01-01T00:00:00.000Z' }] });
    const here = { ...entry, designId: 'newer-in-backup', updatedAt: '2000-01-01T00:00:00.000Z' };
    const merged = mergeWorkspaceBackup({ rhinestoneDesigns: [], htvDesigns: [], papercraftDesigns: [here] }, backup);
    expect(merged.summary).toMatchObject({ addedPapercraft: 1, updatedPapercraft: 1 });
    expect(merged.papercraftDesigns.map((d) => d.designId).sort()).toEqual([entry.designId, 'newer-in-backup'].sort());
    const again = mergeWorkspaceBackup({ rhinestoneDesigns: [], htvDesigns: [], papercraftDesigns: merged.papercraftDesigns }, backup);
    expect(again.summary).toMatchObject({ addedPapercraft: 0, updatedPapercraft: 0, keptNewer: 2 });
    expect(describeMergeSummary(merged.summary, 0)).toBe('Restored: added 1 design, updated 1 to the newer copy.');
  });
});

describe('saved models on the home page and My Designs', () => {
  it('shows a saved model among the recent designs with a picture, and leaves out an archived one', () => {
    const a = buildPapercraftDesignEntry({ ...initialPapercraftState(), projectName: 'Cube' });
    const b = { ...buildPapercraftDesignEntry(initialPapercraftState()), designId: 'archived-one', archived: true };
    const list = buildRecentDesigns({ rhinestoneDesigns: [], htvDesigns: [], papercraftDesigns: [a, b] });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ studio: 'papercraft', name: 'Cube', href: `/papercraft?designId=${a.designId}`, details: 'Test cube · 40 mm (longest side)' });
    expect(list[0].thumbnail?.startsWith('data:image/svg+xml')).toBe(true);
  });

  it('draws the picture of a saved design the same way every time, once per version', () => {
    const entry = buildPapercraftDesignEntry({ ...initialPapercraftState() });
    const one = savedDesignThumbnail(entry);
    expect(one).toBe(savedDesignThumbnail(entry));
    expect(decodeURIComponent(one!)).toContain('<polygon');
    expect(savedDesignThumbnail({ ...entry, designId: 'x', snapshot: { ...entry.snapshot, version: 1, source: { kind: 'builtin', id: 'gone' } } as typeof entry.snapshot })).toBeNull();
  });
});
