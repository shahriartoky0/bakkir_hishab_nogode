import { buildTree, lineage, normalizeNames, validateParent, type Category } from "@/domain/catalog/category";
import {
  validateFieldDefinition,
  type FieldDefinition,
  type FieldDefinitionInput,
} from "@/domain/catalog/field-definition";
import { STARTER_CATEGORIES, STARTER_FIELDS } from "@/domain/catalog/starter-set";
import { domainError, DomainErrorCode, err, ok, type DomainError, type Result } from "@/domain/shared";
import type { Clock } from "../../ports/clock";
import type { UnitOfWork } from "../../ports/repositories";

type Deps = { uow: UnitOfWork; clock: Clock };

export interface SaveCategoryInput {
  id?: string;
  parentId: string | null;
  nameBn?: string | null;
  nameEn?: string | null;
}

export class SaveCategory {
  constructor(private readonly deps: Deps) {}

  execute(input: SaveCategoryInput): Promise<Result<Category, DomainError>> {
    return this.deps.uow.run(async (r) => {
      const names = normalizeNames(input);
      if (!names.ok) return names;
      const all = await r.catalog.listCategories();
      const parent = input.parentId === null ? null : all.find((c) => c.id === input.parentId);
      const parentCheck = validateParent(parent, input.id);
      if (!parentCheck.ok) return parentCheck;

      if (input.id) {
        const existing = all.find((c) => c.id === input.id);
        if (!existing) return err(domainError(DomainErrorCode.NOT_FOUND));
        // A category that has children can't become a child (max 2 levels).
        if (input.parentId !== null && all.some((c) => c.parentId === existing.id)) {
          return err(domainError(DomainErrorCode.CATEGORY_DEPTH));
        }
        await r.catalog.updateCategory(existing.id, { ...names.value, parentId: input.parentId });
        const updated = { ...existing, ...names.value, parentId: input.parentId };
        await r.activity.log({ action: "category.updated", entity: "category", entityId: existing.id, summary: names.value.nameEn ?? names.value.nameBn ?? "", before: existing, after: updated });
        return ok(updated);
      }

      const siblings = all.filter((c) => c.parentId === input.parentId);
      const created = await r.catalog.insertCategory({
        ...names.value,
        parentId: input.parentId,
        sortOrder: siblings.reduce((m, c) => Math.max(m, c.sortOrder), -1) + 1,
        archivedAt: null,
      });
      await r.activity.log({ action: "category.created", entity: "category", entityId: created.id, summary: created.nameEn ?? created.nameBn ?? "", after: created });
      return ok(created);
    });
  }
}

export class ArchiveCategory {
  constructor(private readonly deps: Deps) {}

  execute(input: { id: string; archived: boolean }): Promise<Result<null, DomainError>> {
    return this.deps.uow.run(async (r) => {
      const all = await r.catalog.listCategories();
      const cat = all.find((c) => c.id === input.id);
      if (!cat) return err(domainError(DomainErrorCode.NOT_FOUND));
      const archivedAt = input.archived ? this.deps.clock.now() : null;
      await r.catalog.updateCategory(cat.id, { archivedAt });
      // Archiving a parent archives its children too.
      if (input.archived) {
        for (const child of all.filter((c) => c.parentId === cat.id && !c.archivedAt)) {
          await r.catalog.updateCategory(child.id, { archivedAt });
        }
      }
      await r.activity.log({ action: input.archived ? "category.archived" : "category.restored", entity: "category", entityId: cat.id, summary: cat.nameEn ?? cat.nameBn ?? "" });
      return ok(null);
    });
  }
}

export class ReorderCategories {
  constructor(private readonly deps: Deps) {}

  /** `orderedIds` = siblings in their new order. */
  execute(orderedIds: string[]): Promise<Result<null, DomainError>> {
    return this.deps.uow.run(async (r) => {
      const all = await r.catalog.listCategories();
      const parents = new Set(orderedIds.map((id) => all.find((c) => c.id === id)?.parentId));
      if (parents.size !== 1 || orderedIds.some((id) => !all.some((c) => c.id === id))) {
        return err(domainError(DomainErrorCode.VALIDATION));
      }
      for (const [i, id] of orderedIds.entries()) await r.catalog.updateCategory(id, { sortOrder: i });
      return ok(null);
    });
  }
}

export interface SaveFieldInput extends FieldDefinitionInput {
  id?: string;
  categoryId: string | null;
}

/** Keys already used by fields that would apply alongside one in `categoryId`. */
function keysInScope(categoryId: string | null, categories: Category[], fields: FieldDefinition[], selfId?: string): string[] {
  const scope = new Set<string | null>([null, ...lineage(categoryId, categories)]);
  // A global field (or a parent's) also collides with every descendant's fields.
  const descendants = categoryId === null
    ? categories.map((c) => c.id)
    : categories.filter((c) => c.parentId === categoryId).map((c) => c.id);
  for (const d of descendants) scope.add(d);
  return fields.filter((f) => f.id !== selfId && !f.archivedAt && scope.has(f.categoryId)).map((f) => f.key);
}

export class SaveField {
  constructor(private readonly deps: Deps) {}

  execute(input: SaveFieldInput): Promise<Result<FieldDefinition, DomainError>> {
    return this.deps.uow.run(async (r) => {
      const [categories, fields] = await Promise.all([r.catalog.listCategories(), r.catalog.listFields()]);
      if (input.categoryId && !categories.some((c) => c.id === input.categoryId)) {
        return err(domainError(DomainErrorCode.NOT_FOUND));
      }

      if (input.id) {
        const existing = fields.find((f) => f.id === input.id);
        if (!existing) return err(domainError(DomainErrorCode.NOT_FOUND));
        // key and type are immutable; validate the rest against the existing key/type.
        const v = validateFieldDefinition({ ...input, key: existing.key, type: existing.type }, []);
        if (!v.ok) return v;
        const { labelBn, labelEn, options, unitBn, unitEn, isRequired, showOnReceipt } = v.value;
        const patch = { labelBn, labelEn, options, unitBn, unitEn, isRequired, showOnReceipt };
        await r.catalog.updateField(existing.id, patch);
        const updated = { ...existing, ...patch };
        await r.activity.log({ action: "field.updated", entity: "field", entityId: existing.id, summary: existing.key, before: existing, after: updated });
        return ok(updated);
      }

      const v = validateFieldDefinition(input, keysInScope(input.categoryId, categories, fields));
      if (!v.ok) return v;
      const siblings = fields.filter((f) => f.categoryId === input.categoryId);
      const created = await r.catalog.insertField({
        ...v.value,
        categoryId: input.categoryId,
        sortOrder: siblings.reduce((m, f) => Math.max(m, f.sortOrder), -1) + 1,
        archivedAt: null,
      });
      await r.activity.log({ action: "field.created", entity: "field", entityId: created.id, summary: created.key, after: created });
      return ok(created);
    });
  }
}

export class ArchiveField {
  constructor(private readonly deps: Deps) {}

  execute(input: { id: string; archived: boolean }): Promise<Result<null, DomainError>> {
    return this.deps.uow.run(async (r) => {
      const fields = await r.catalog.listFields();
      const f = fields.find((x) => x.id === input.id);
      if (!f) return err(domainError(DomainErrorCode.NOT_FOUND));
      if (!input.archived) {
        const categories = await r.catalog.listCategories();
        if (keysInScope(f.categoryId, categories, fields, f.id).includes(f.key)) {
          return err(domainError(DomainErrorCode.DUPLICATE_FIELD_KEY, { key: f.key }));
        }
      }
      await r.catalog.updateField(f.id, { archivedAt: input.archived ? this.deps.clock.now() : null });
      await r.activity.log({ action: input.archived ? "field.archived" : "field.restored", entity: "field", entityId: f.id, summary: f.key });
      return ok(null);
    });
  }
}

export class ReorderFields {
  constructor(private readonly deps: Deps) {}

  execute(orderedIds: string[]): Promise<Result<null, DomainError>> {
    return this.deps.uow.run(async (r) => {
      const fields = await r.catalog.listFields();
      if (orderedIds.some((id) => !fields.some((f) => f.id === id))) return err(domainError(DomainErrorCode.VALIDATION));
      for (const [i, id] of orderedIds.entries()) await r.catalog.updateField(id, { sortOrder: i });
      return ok(null);
    });
  }
}

/** Jewelry starter set (spec 6.1): skips categories/fields that already exist. */
export class ApplyStarterSet {
  constructor(private readonly deps: Deps) {}

  execute(input: { apply: boolean }): Promise<Result<{ categories: number; fields: number }, DomainError>> {
    return this.deps.uow.run(async (r) => {
      let createdCategories = 0;
      let createdFields = 0;
      if (input.apply) {
        createdCategories = 0;
        const refToId = new Map<string, string>();
        const existing = await r.catalog.listCategories();
        for (const [i, sc] of STARTER_CATEGORIES.entries()) {
          const found = existing.find(
            (c) => c.parentId === null && (c.nameEn?.toLowerCase() === sc.nameEn.toLowerCase() || c.nameBn === sc.nameBn),
          );
          if (found) {
            refToId.set(sc.ref, found.id);
            continue;
          }
          const c = await r.catalog.insertCategory({ parentId: null, nameBn: sc.nameBn, nameEn: sc.nameEn, sortOrder: existing.length + i, archivedAt: null });
          refToId.set(sc.ref, c.id);
          createdCategories++;
        }
        const fields = await r.catalog.listFields();
        for (const [i, sf] of STARTER_FIELDS.entries()) {
          const categoryId = sf.category ? (refToId.get(sf.category) ?? null) : null;
          if (fields.some((f) => f.key === sf.key && f.categoryId === categoryId)) continue;
          await r.catalog.insertField({
            categoryId,
            key: sf.key,
            labelBn: sf.labelBn,
            labelEn: sf.labelEn,
            type: sf.type,
            options: sf.options ?? [],
            unitBn: sf.unitBn ?? null,
            unitEn: sf.unitEn ?? null,
            isRequired: sf.isRequired ?? false,
            showOnReceipt: true,
            sortOrder: i,
            archivedAt: null,
          });
          createdFields++;
        }
        await r.activity.log({ action: "catalog.starter_set", entity: "category", entityId: null, summary: "starter set", after: { createdCategories, createdFields } });
      }
      await r.settings.update({ starterSetDecidedAt: this.deps.clock.now() });
      return ok({ categories: createdCategories, fields: createdFields });
    });
  }
}

export { buildTree };
