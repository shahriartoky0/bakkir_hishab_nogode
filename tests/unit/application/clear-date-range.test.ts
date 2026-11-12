import { describe, expect, it } from "vitest";
import { ClearDateRange } from "@/application/use-cases/admin/clear-date-range";
import { FakeClock, FakeFileStorage } from "../../fakes";
import { InMemoryStore } from "../../fakes/in-memory-repos";

const setup = () => {
  const store = new InMemoryStore();
  const storage = new FakeFileStorage();
  return { store, storage, uc: new ClearDateRange({ uow: store, clock: new FakeClock(), storage }) };
};

describe("ClearDateRange", () => {
  it("requires the typed confirmation", async () => {
    const { uc, store } = setup();
    const r = await uc.execute({ from: "2026-11-01", to: "2026-11-12", removeEmptyCustomers: true, confirm: "delete it" });
    expect(!r.ok && r.error.code).toBe("CONFIRM_REQUIRED");
    expect(store.erased).toEqual([]);
  });

  it("rejects a reversed or invalid range", async () => {
    const { uc } = setup();
    const reversed = await uc.preview({ from: "2026-11-12", to: "2026-11-01", removeEmptyCustomers: false });
    expect(!reversed.ok && reversed.error.code).toBe("INVALID_RANGE");
    const bad = await uc.execute({ from: "2026-13-01", to: "2026-11-01", removeEmptyCustomers: false, confirm: "DELETE" });
    expect(!bad.ok && bad.error.code).toBe("INVALID_DATE");
  });

  it('accepts any length of range, e.g. "All time"', async () => {
    const { uc, store } = setup();
    const range = { from: "2000-01-01", to: "2026-11-12", removeEmptyCustomers: true };
    expect((await uc.preview(range)).ok).toBe(true);
    expect((await uc.execute({ ...range, confirm: "DELETE" })).ok).toBe(true);
    expect(store.erased).toEqual([{ from: "2000-01-01", to: "2026-11-12" }]);
  });

  it("erases, logs the action and deletes photos after commit", async () => {
    const { uc, store, storage } = setup();
    const r = await uc.execute({ from: "2026-11-01", to: "2026-11-12", removeEmptyCustomers: true, confirm: "DELETE" });
    expect(r.ok).toBe(true);
    expect(store.erased).toEqual([{ from: "2026-11-01", to: "2026-11-12" }]);
    expect(store.activity.at(-1)?.action).toBe("data.cleared");
    expect(storage.deleted).toEqual(["item/x.jpg"]);
  });
});
