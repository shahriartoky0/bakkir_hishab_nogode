import { beforeEach, describe, expect, it } from "vitest";
import { ChangePassword } from "@/application/use-cases/auth/account";
import {
  ApplyStarterSet,
  ArchiveCategory,
  ArchiveField,
  ReorderCategories,
  ReorderFields,
  SaveCategory,
  SaveField,
} from "@/application/use-cases/catalog/catalog";
import { SetCustomerStatus, SaveCustomer } from "@/application/use-cases/customers/customers";
import { SetTranslationOverride } from "@/application/use-cases/i18n/translation-overrides";
import { UpdateSettings, validateSettingsPatch } from "@/application/use-cases/settings/update-settings";
import { FakeClock } from "../../fakes";
import { InMemoryStore } from "../../fakes/in-memory-repos";

describe("settings", () => {
  it("validates prefixes, credit days, auto-logout and locale", () => {
    expect(validateSettingsPatch({ salePrefix: " INV- " })).toEqual({ ok: true, value: { salePrefix: "INV-" } });
    expect(validateSettingsPatch({ salePrefix: "" }).ok).toBe(false);
    expect(validateSettingsPatch({ receiptPrefix: "রসিদ" }).ok).toBe(false);
    expect(validateSettingsPatch({ defaultCreditDays: 366 }).ok).toBe(false);
    expect(validateSettingsPatch({ defaultCreditDays: 0 }).ok).toBe(true);
    expect(validateSettingsPatch({ autoLogoutMinutes: 4 }).ok).toBe(false);
    expect(validateSettingsPatch({ autoLogoutMinutes: 30 }).ok).toBe(true);
    expect(validateSettingsPatch({ defaultLocale: "fr" as "bn" }).ok).toBe(false);
    expect(validateSettingsPatch({ shopNameBn: "  " })).toEqual({ ok: true, value: { shopNameBn: null } });
  });

  it("saves and logs before/after", async () => {
    const store = new InMemoryStore();
    const r = await new UpdateSettings({ uow: store }).execute({ shopNameEn: "Rupa Jewellers", defaultCreditDays: 45 });
    expect(r.ok && r.value.defaultCreditDays).toBe(45);
    expect(store.activity.at(-1)?.action).toBe("settings.updated");
  });
});

describe("catalog", () => {
  let store: InMemoryStore;
  let deps: { uow: InMemoryStore; clock: FakeClock };

  beforeEach(() => {
    store = new InMemoryStore();
    deps = { uow: store, clock: new FakeClock() };
  });

  it("applies the starter set once and records the decision", async () => {
    const first = await new ApplyStarterSet(deps).execute({ apply: true });
    expect(first).toEqual({ ok: true, value: { categories: 4, fields: 3 } });
    expect(store.settings.starterSetDecidedAt).not.toBeNull();
    const again = await new ApplyStarterSet(deps).execute({ apply: true });
    expect(again).toEqual({ ok: true, value: { categories: 0, fields: 0 } });
  });

  it("declining the starter set creates nothing", async () => {
    const r = await new ApplyStarterSet(deps).execute({ apply: false });
    expect(r).toEqual({ ok: true, value: { categories: 0, fields: 0 } });
    expect(store.categories).toHaveLength(0);
    expect(store.settings.starterSetDecidedAt).not.toBeNull();
  });

  it("reorders siblings and rejects mixed parents", async () => {
    const save = new SaveCategory(deps);
    const a = await save.execute({ parentId: null, nameEn: "Gold" });
    const b = await save.execute({ parentId: null, nameEn: "Silver" });
    if (!a.ok || !b.ok) throw new Error("setup");
    const ring = await save.execute({ parentId: a.value.id, nameEn: "Ring" });
    if (!ring.ok) throw new Error("setup");

    expect((await new ReorderCategories(deps).execute([b.value.id, a.value.id])).ok).toBe(true);
    expect(store.categories.find((c) => c.id === b.value.id)?.sortOrder).toBe(0);
    expect((await new ReorderCategories(deps).execute([a.value.id, ring.value.id])).ok).toBe(false);
  });

  it("archiving a parent archives its children", async () => {
    const save = new SaveCategory(deps);
    const gold = await save.execute({ parentId: null, nameBn: "সোনা" });
    if (!gold.ok) throw new Error("setup");
    await save.execute({ parentId: gold.value.id, nameBn: "আংটি" });
    await new ArchiveCategory(deps).execute({ id: gold.value.id, archived: true });
    expect(store.categories.every((c) => c.archivedAt !== null)).toBe(true);
  });

  it("restoring a field fails when its key is now used by another active field", async () => {
    const saveField = new SaveField(deps);
    const f1 = await saveField.execute({ categoryId: null, key: "weight", labelEn: "Weight", type: "decimal" });
    if (!f1.ok) throw new Error("setup");
    await new ArchiveField(deps).execute({ id: f1.value.id, archived: true });
    await saveField.execute({ categoryId: null, key: "weight", labelEn: "Weight 2", type: "decimal" });
    const restore = await new ArchiveField(deps).execute({ id: f1.value.id, archived: false });
    expect(!restore.ok && restore.error.code).toBe("DUPLICATE_FIELD_KEY");
  });

  it("reorders fields", async () => {
    const saveField = new SaveField(deps);
    const a = await saveField.execute({ categoryId: null, key: "a", labelEn: "A", type: "text" });
    const b = await saveField.execute({ categoryId: null, key: "b", labelEn: "B", type: "text" });
    if (!a.ok || !b.ok) throw new Error("setup");
    await new ReorderFields(deps).execute([b.value.id, a.value.id]);
    expect(store.fields.find((f) => f.id === b.value.id)?.sortOrder).toBe(0);
    expect((await new ReorderFields(deps).execute(["nope"])).ok).toBe(false);
  });
});

describe("customer status", () => {
  it("blocks and archives with an activity entry", async () => {
    const store = new InMemoryStore();
    const deps = { uow: store, clock: new FakeClock() };
    const c = await new SaveCustomer({ uow: store }).execute({ name: "Karim", phone: "01812345678" });
    if (!c.ok) throw new Error("setup");
    await new SetCustomerStatus(deps).execute({ id: c.value.id, blocked: true });
    await new SetCustomerStatus(deps).execute({ id: c.value.id, archived: true });
    const saved = store.customers.find((x) => x.id === c.value.id)!;
    expect(saved.isBlocked).toBe(true);
    expect(saved.archivedAt).not.toBeNull();
    expect(store.activity.map((a) => a.action)).toEqual(expect.arrayContaining(["customer.blocked", "customer.archived"]));
  });
});

describe("translation overrides", () => {
  it("sets and resets known keys only", async () => {
    const store = new InMemoryStore();
    const uc = new SetTranslationOverride({ uow: store, knownKeys: () => new Set(["nav.home"]) });
    expect((await uc.execute({ locale: "bn", key: "nav.home", value: "শুরু" })).ok).toBe(true);
    expect(store.translations).toEqual([{ locale: "bn", key: "nav.home", value: "শুরু" }]);
    expect((await uc.execute({ locale: "bn", key: "nav.home", value: null })).ok).toBe(true);
    expect(store.translations).toEqual([]);
    const unknown = await uc.execute({ locale: "bn", key: "nope", value: "x" });
    expect(!unknown.ok && unknown.error.code).toBe("NOT_FOUND");
  });
});

describe("change password", () => {
  const gateway = (ok: boolean) => ({ changePassword: async () => ok, signOutEverywhere: async () => undefined });

  it("maps a wrong current password to WRONG_PASSWORD", async () => {
    const r = await new ChangePassword({ account: gateway(false) }).execute({ currentPassword: "old-pass-1", newPassword: "new-pass-1" });
    expect(!r.ok && r.error.code).toBe("WRONG_PASSWORD");
  });

  it("rejects short or unchanged passwords", async () => {
    const uc = new ChangePassword({ account: gateway(true) });
    expect((await uc.execute({ currentPassword: "old-pass-1", newPassword: "short" })).ok).toBe(false);
    expect((await uc.execute({ currentPassword: "same-pass-1", newPassword: "same-pass-1" })).ok).toBe(false);
    expect((await uc.execute({ currentPassword: "old-pass-1", newPassword: "new-pass-1" })).ok).toBe(true);
  });
});
