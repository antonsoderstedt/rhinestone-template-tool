import type { TemplateLibraryEntry, TemplateLibraryRecord } from './model';

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

export class InMemoryTemplateLibraryRepository implements TemplateLibraryRepository {
  private record: TemplateLibraryRecord;

  constructor(initialRecord?: TemplateLibraryRecord) {
    this.record = initialRecord ? cloneRecord(initialRecord) : {
      version: 1,
      builtInTemplates: [],
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
