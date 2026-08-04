import type { TemplateLibraryEntry, TemplateLibraryRecord } from './model';
import { STARTER_TEMPLATE_LIBRARY_ENTRIES } from './starterTemplates';

export interface TemplateLibraryRepository {
  list(): Promise<TemplateLibraryRecord>;
  get(templateId: string): Promise<TemplateLibraryEntry | null>;
  save(entry: TemplateLibraryEntry): Promise<TemplateLibraryEntry>;
  rename(templateId: string, nextName: string): Promise<TemplateLibraryEntry>;
  duplicate(templateId: string, nextTemplateId: string, nextName: string): Promise<TemplateLibraryEntry>;
  delete(templateId: string): Promise<void>;
  favorite(templateId: string, favorite: boolean): Promise<TemplateLibraryEntry>;
}

function cloneRecord(record: TemplateLibraryRecord): TemplateLibraryRecord {
  return structuredClone(record);
}

export const DEFAULT_TEMPLATE_LIBRARY_STORAGE_KEY = 'rhinestone-template-library';

function normalizeRecord(record: TemplateLibraryRecord | null | undefined): TemplateLibraryRecord {
  if (!record || record.version !== 1) {
    return {
      version: 1,
      builtInTemplates: [...STARTER_TEMPLATE_LIBRARY_ENTRIES],
      userTemplates: [],
    };
  }

  return {
    version: 1,
    builtInTemplates: Array.isArray(record.builtInTemplates) && record.builtInTemplates.length > 0
      ? record.builtInTemplates
      : [...STARTER_TEMPLATE_LIBRARY_ENTRIES],
    userTemplates: Array.isArray(record.userTemplates) ? record.userTemplates : [],
  };
}

function getBrowserStorage(): Storage | null {
  const maybeStorage = globalThis.localStorage;
  return typeof maybeStorage === 'object' && maybeStorage !== null ? maybeStorage : null;
}

export class LocalStorageTemplateLibraryRepository implements TemplateLibraryRepository {
  constructor(private readonly storageKey = DEFAULT_TEMPLATE_LIBRARY_STORAGE_KEY) {}

  private readRecord(): TemplateLibraryRecord {
    const storage = getBrowserStorage();
    if (!storage) {
      return normalizeRecord(null);
    }

    const raw = storage.getItem(this.storageKey);
    if (!raw) return normalizeRecord(null);

    try {
      return normalizeRecord(JSON.parse(raw) as TemplateLibraryRecord);
    } catch {
      return normalizeRecord(null);
    }
  }

  private writeRecord(record: TemplateLibraryRecord): void {
    const storage = getBrowserStorage();
    if (!storage) {
      throw new Error('Template library storage is unavailable in this environment.');
    }

    storage.setItem(this.storageKey, JSON.stringify(record));
  }

  async list(): Promise<TemplateLibraryRecord> {
    return cloneRecord(this.readRecord());
  }

  async get(templateId: string): Promise<TemplateLibraryEntry | null> {
    const record = this.readRecord();
    const entry = [...record.builtInTemplates, ...record.userTemplates].find((item) => item.templateId === templateId);
    return entry ? structuredClone(entry) : null;
  }

  async save(entry: TemplateLibraryEntry): Promise<TemplateLibraryEntry> {
    if (entry.readOnly || entry.builtIn) {
      throw new Error('Built-in templates are immutable and cannot be overwritten.');
    }

    const record = this.readRecord();
    const nextEntry = structuredClone(entry);
    const index = record.userTemplates.findIndex((item) => item.templateId === nextEntry.templateId);
    if (index >= 0) {
      record.userTemplates[index] = nextEntry;
    } else {
      record.userTemplates.push(nextEntry);
    }
    this.writeRecord(record);
    return structuredClone(nextEntry);
  }

  async rename(templateId: string, nextName: string): Promise<TemplateLibraryEntry> {
    const record = this.readRecord();
    const entry = record.userTemplates.find((item) => item.templateId === templateId);
    if (!entry) {
      throw new Error('Only user templates can be renamed.');
    }
    entry.name = nextName;
    entry.updatedAt = new Date().toISOString();
    this.writeRecord(record);
    return structuredClone(entry);
  }

  async duplicate(templateId: string, nextTemplateId: string, nextName: string): Promise<TemplateLibraryEntry> {
    const record = this.readRecord();
    const source = [...record.builtInTemplates, ...record.userTemplates].find((item) => item.templateId === templateId);
    if (!source) {
      throw new Error(`Template ${templateId} was not found.`);
    }
    const now = new Date().toISOString();
    const clone = structuredClone(source);
    clone.templateId = nextTemplateId;
    clone.name = nextName;
    clone.builtIn = false;
    clone.readOnly = false;
    clone.favorite = false;
    clone.createdAt = now;
    clone.updatedAt = now;
    record.userTemplates.push(clone);
    this.writeRecord(record);
    return structuredClone(clone);
  }

  async delete(templateId: string): Promise<void> {
    const record = this.readRecord();
    const index = record.userTemplates.findIndex((item) => item.templateId === templateId);
    if (index === -1) {
      throw new Error('Built-in templates cannot be deleted.');
    }
    record.userTemplates.splice(index, 1);
    this.writeRecord(record);
  }

  async favorite(templateId: string, favorite: boolean): Promise<TemplateLibraryEntry> {
    const record = this.readRecord();
    const entry = record.userTemplates.find((item) => item.templateId === templateId)
      ?? record.builtInTemplates.find((item) => item.templateId === templateId);
    if (!entry) {
      throw new Error(`Template ${templateId} was not found.`);
    }
    entry.favorite = favorite;
    entry.updatedAt = new Date().toISOString();
    this.writeRecord(record);
    return structuredClone(entry);
  }
}

export class InMemoryTemplateLibraryRepository implements TemplateLibraryRepository {
  private record: TemplateLibraryRecord;

  constructor(initialRecord?: TemplateLibraryRecord) {
    this.record = initialRecord ? cloneRecord(initialRecord) : {
      version: 1,
      builtInTemplates: [...STARTER_TEMPLATE_LIBRARY_ENTRIES],
      userTemplates: [],
    };
  }

  async list(): Promise<TemplateLibraryRecord> {
    return cloneRecord(this.record);
  }

  async get(templateId: string): Promise<TemplateLibraryEntry | null> {
    const template = [...this.record.builtInTemplates, ...this.record.userTemplates].find((entry) => entry.templateId === templateId);
    return template ? structuredClone(template) : null;
  }

  async save(entry: TemplateLibraryEntry): Promise<TemplateLibraryEntry> {
    if (entry.readOnly || entry.builtIn) {
      throw new Error('Built-in templates are immutable and cannot be overwritten.');
    }
    const nextEntry = structuredClone(entry);
    const index = this.record.userTemplates.findIndex((item) => item.templateId === entry.templateId);
    if (index >= 0) {
      this.record.userTemplates[index] = nextEntry;
    } else {
      this.record.userTemplates.push(nextEntry);
    }
    return structuredClone(nextEntry);
  }

  async rename(templateId: string, nextName: string): Promise<TemplateLibraryEntry> {
    const entry = this.record.userTemplates.find((item) => item.templateId === templateId);
    if (!entry) {
      throw new Error('Only user templates can be renamed.');
    }
    entry.name = nextName;
    entry.updatedAt = new Date().toISOString();
    return structuredClone(entry);
  }

  async duplicate(templateId: string, nextTemplateId: string, nextName: string): Promise<TemplateLibraryEntry> {
    const source = [...this.record.builtInTemplates, ...this.record.userTemplates].find((item) => item.templateId === templateId);
    if (!source) {
      throw new Error(`Template ${templateId} was not found.`);
    }
    const now = new Date().toISOString();
    const clone = structuredClone(source);
    clone.templateId = nextTemplateId;
    clone.name = nextName;
    clone.builtIn = false;
    clone.readOnly = false;
    clone.favorite = false;
    clone.createdAt = now;
    clone.updatedAt = now;
    this.record.userTemplates.push(clone);
    return structuredClone(clone);
  }

  async delete(templateId: string): Promise<void> {
    const index = this.record.userTemplates.findIndex((item) => item.templateId === templateId);
    if (index === -1) {
      throw new Error('Built-in templates cannot be deleted.');
    }
    this.record.userTemplates.splice(index, 1);
  }

  async favorite(templateId: string, favorite: boolean): Promise<TemplateLibraryEntry> {
    const entry = this.record.userTemplates.find((item) => item.templateId === templateId)
      ?? this.record.builtInTemplates.find((item) => item.templateId === templateId);
    if (!entry) {
      throw new Error(`Template ${templateId} was not found.`);
    }
    entry.favorite = favorite;
    entry.updatedAt = new Date().toISOString();
    return structuredClone(entry);
  }
}
