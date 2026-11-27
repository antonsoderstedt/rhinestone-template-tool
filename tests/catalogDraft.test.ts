import { describe, expect, it } from 'vitest';
import { detailsOf, draftOf, draftProblems, emptyDraft, parseTags } from '../app/admin/catalogDraft';
import type { CatalogTemplate } from '../app/lib/catalog/catalogClient';

describe('catalog draft', () => {
  it('starts with the first format of the studio', () => {
    expect(emptyDraft('papercraft').format).toBe('obj');
    expect(emptyDraft('htv').format).toBe('svg');
  });

  it('splits tags on commas and new lines, trims, and drops repeats', () => {
    expect(parseTags(' a, b ;a\n c ,,')).toEqual(['a', 'b', 'c']);
  });

  it('makes the id from the name for a new template and keeps the id of an old one', () => {
    const draft = { ...emptyDraft(), name: ' Björn 3D ' };
    expect(detailsOf(draft, null).id).toBe('bjorn-3d');
    expect(detailsOf({ ...draft, id: 'my-own-id' }, null).id).toBe('my-own-id');
    expect(detailsOf({ ...draft, isNew: false, id: 'old-id' }, null).id).toBe('old-id');
  });

  it('takes the format from the chosen file, and the custom fields without empty names', () => {
    const draft = { ...emptyDraft(), name: 'X', fields: [{ key: ' Designer ', value: ' Me ' }, { key: '', value: 'lost' }, { key: 'Designer', value: 'You' }] };
    const details = detailsOf(draft, 'pdf');
    expect(details.format).toBe('pdf');
    expect(details.fields).toEqual({ Designer: 'You' });
  });

  it('finds what is wrong: no name, a bad id, a file the studio cannot use, publishing without a file', () => {
    expect(draftProblems({ ...emptyDraft(), name: '' }, null, false)).toContain('name');
    expect(draftProblems({ ...emptyDraft(), name: 'X', id: 'Bad Id' }, null, false)).toContain('id');
    expect(draftProblems({ ...emptyDraft('htv'), name: 'X' }, 'model.obj', false)).toContain('format');
    expect(draftProblems({ ...emptyDraft('rhinestone'), name: 'X' }, 'star.json', false)).toEqual(['project-name']);
    expect(draftProblems({ ...emptyDraft('rhinestone'), name: 'X' }, 'star.rhinestone.json', false)).toEqual([]);
    expect(draftProblems({ ...emptyDraft('papercraft'), name: 'X' }, 'design.json', false)).toEqual([]);
    expect(draftProblems({ ...emptyDraft(), name: 'X', published: true }, null, false)).toContain('publish-without-file');
    expect(draftProblems({ ...emptyDraft(), name: 'X', published: true }, null, true)).toEqual([]);
    expect(draftProblems({ ...emptyDraft(), name: 'X' }, 'box.OBJ', false)).toEqual([]);
  });

  it('opens an existing template for editing', () => {
    const template: CatalogTemplate = { id: 'box', studio: 'papercraft', format: 'obj', name: 'Box', description: 'd', category: 'c', tags: ['a', 'b'], licence: 'l', fields: { k: 'v' }, published: true, createdAt: '', updatedAt: '', file: null, preview: null };
    expect(draftOf(template)).toMatchObject({ isNew: false, id: 'box', tagsText: 'a, b', fields: [{ key: 'k', value: 'v' }], published: true });
  });
});
