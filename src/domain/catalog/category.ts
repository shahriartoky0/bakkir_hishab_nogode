import { hasAnyText } from "../shared/bilingual";
import { domainError, DomainErrorCode, type DomainError } from "../shared/domain-error";
import { err, ok, type Result } from "../shared/result";

export interface Category {
  id: string;
  parentId: string | null;
  nameBn: string | null;
  nameEn: string | null;
  sortOrder: number;
  archivedAt: Date | null;
}

export const MAX_CATEGORY_DEPTH = 2;

export interface CategoryNames {
  nameBn?: string | null;
  nameEn?: string | null;
}

export function normalizeNames(input: CategoryNames): Result<{ nameBn: string | null; nameEn: string | null }, DomainError> {
  const nameBn = input.nameBn?.trim() || null;
  const nameEn = input.nameEn?.trim() || null;
  if (!hasAnyText(nameBn, nameEn)) return err(domainError(DomainErrorCode.NAME_REQUIRED));
  return ok({ nameBn, nameEn });
}

/** Categories are at most 2 levels: a parent must itself be top-level. */
export function validateParent(parent: Category | null | undefined, selfId?: string): Result<null, DomainError> {
  if (parent === undefined) return err(domainError(DomainErrorCode.NOT_FOUND));
  if (parent === null) return ok(null);
  if (parent.parentId !== null || parent.id === selfId) {
    return err(domainError(DomainErrorCode.CATEGORY_DEPTH));
  }
  return ok(null);
}

/** Category plus its ancestors (self first). Fields of any of them apply. */
export function lineage(categoryId: string | null, all: readonly Category[]): string[] {
  const ids: string[] = [];
  let current = categoryId ? all.find((c) => c.id === categoryId) : undefined;
  while (current && ids.length < MAX_CATEGORY_DEPTH + 1) {
    ids.push(current.id);
    current = current.parentId ? all.find((c) => c.id === current!.parentId) : undefined;
  }
  return ids;
}

export interface CategoryNode extends Category {
  children: Category[];
}

/** Build the 2-level tree ordered by sortOrder. */
export function buildTree(all: readonly Category[]): CategoryNode[] {
  const byOrder = (a: Category, b: Category) => a.sortOrder - b.sortOrder || (a.nameEn ?? "").localeCompare(b.nameEn ?? "");
  return all
    .filter((c) => c.parentId === null)
    .sort(byOrder)
    .map((p) => ({ ...p, children: all.filter((c) => c.parentId === p.id).sort(byOrder) }));
}
