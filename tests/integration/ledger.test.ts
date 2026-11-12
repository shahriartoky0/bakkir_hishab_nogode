/**
 * Runs against a Neon BRANCH (never production): set DATABASE_URL in .env.test.local.
 * Exercises the real SQL repositories, the balance views and the DB triggers.
 */
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

config({ path: ".env.test.local", override: true, quiet: true });
const url = process.env.DATABASE_URL ?? "";
async function expectDbError(p: Promise<unknown>, re: RegExp) {
  const e = await p.then(() => null, (x: unknown) => x as { message?: string; cause?: { message?: string } });
  expect(e, "expected the statement to fail").not.toBeNull();
  expect(`${e?.message} ${e?.cause?.message ?? ""}`).toMatch(re);
}
const todayDhaka = () => new Date(Date.now() + 6 * 3_600_000).toISOString().slice(0, 10);
const isBranch = url.length > 0 && !url.includes(process.env.PRODUCTION_ENDPOINT_GUARD ?? "ep-fragrant-thunder");

describe.skipIf(!isBranch)("ledger against Neon branch", () => {
  let mods: Awaited<ReturnType<typeof load>>;
  let customerId: string;
  const photo = { fileKey: "item/2026-11/0196f3a2-1111-7000-8000-000000000001.jpg", thumbKey: "item/2026-11/0196f3a2-1111-7000-8000-000000000001_thumb.jpg" };

  async function load() {
    const { getDb } = await import("@/infrastructure/db/client");
    const { DrizzleUnitOfWork } = await import("@/infrastructure/repositories/drizzle-repos");
    const { DrizzleQueries } = await import("@/infrastructure/queries/drizzle-queries");
    const { systemClock } = await import("@/infrastructure/clock/system-clock");
    const sales = await import("@/application/use-cases/sales/sales");
    const pay = await import("@/application/use-cases/payments/payments");
    const cust = await import("@/application/use-cases/customers/customers");
    const admin = await import("@/application/use-cases/admin/clear-date-range");
    const { FakeFileStorage } = await import("../fakes");
    const db = getDb();
    const deps = { uow: new DrizzleUnitOfWork(db), clock: systemClock };
    return { db, deps, queries: new DrizzleQueries(db), ...sales, ...pay, ...cust, ...admin, storage: new FakeFileStorage() };
  }

  beforeAll(async () => {
    mods = await load();
    const phone = `+88017${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
    const c = await new mods.SaveCustomer({ uow: mods.deps.uow }).execute({ name: "Integration Test", nameBn: "পরীক্ষা", phone });
    if (!c.ok) throw new Error(JSON.stringify(c.error));
    customerId = c.value.id;
  });

  afterAll(async () => {
    // archive, never delete
    await mods.db.execute(sql`update customers set archived_at = now() where id = ${customerId}`);
  });

  it("sale → payment → void → adjustments keep views consistent", async () => {
    const created = await new mods.CreateSale(mods.deps).execute({
      idempotencyKey: crypto.randomUUID(),
      customerId,
      items: [{ categoryId: null, name: "Test ring", quantity: 2, unitPriceMinor: 25_000_00, customFields: {}, photos: [photo] }],
      discountMinor: 1_000_00,
      upfront: { amountMinor: 9_000_00, method: "cash" },
      plan: { kind: "installments", count: 2, frequency: "monthly", firstDate: todayDhaka() },
      confirmWarnings: true,
    });
    expect(created.ok).toBe(true);
    const saleId = created.ok ? created.value.saleId : "";

    expect(await mods.queries.customerBalance(customerId)).toBe(40_000_00);
    const detail = await mods.queries.saleDetail(saleId);
    expect(detail?.installments.map((i) => i.amountMinor)).toEqual([9_000_00, 20_000_00, 20_000_00]);
    expect(detail?.editable).toBe(true);

    const paid = await new mods.ReceivePayment(mods.deps).execute({ idempotencyKey: crypto.randomUUID(), customerId, amountMinor: 25_000_00, method: "bkash", reference: "TRX" });
    expect(paid.ok).toBe(true);
    expect(await mods.queries.customerBalance(customerId)).toBe(15_000_00);
    expect((await mods.queries.saleDetail(saleId))?.editable).toBe(false);

    const over = await new mods.ReceivePayment(mods.deps).execute({ idempotencyKey: crypto.randomUUID(), customerId, amountMinor: 15_000_01, method: "cash" });
    expect(!over.ok && over.error.code).toBe("OVERPAYMENT");

    const paymentId = paid.ok ? paid.value.paymentId : "";
    await new mods.VoidPayment(mods.deps).execute({ paymentId, reason: "test void" });
    expect(await mods.queries.customerBalance(customerId)).toBe(40_000_00);

    await new mods.CreateAdjustment(mods.deps).execute({ customerId, type: "opening_balance", amountMinor: 3_000_00, reason: "old khata" });
    await new mods.CreateAdjustment(mods.deps).execute({ customerId, type: "write_off", amountMinor: 43_000_00, reason: "test write off" });
    expect(await mods.queries.customerBalance(customerId)).toBe(0);
    expect((await mods.queries.saleDetail(saleId))?.sale.status).toBe("written_off");

    const ledger = await mods.queries.customerLedger(customerId);
    expect(ledger.entries.at(-1)?.balanceMinor).toBe(0);
    const profile = await mods.queries.customerProfile(customerId);
    expect(profile?.balanceMinor).toBe(0);
  });

  it("DB constraints: no over-allocation, no deletes, append-only log", async () => {
    const created = await new mods.CreateSale(mods.deps).execute({
      idempotencyKey: crypto.randomUUID(),
      customerId,
      items: [{ categoryId: null, name: "Chain", quantity: 1, unitPriceMinor: 1_000_00, customFields: {}, photos: [photo] }],
      discountMinor: 0,
      upfront: { amountMinor: 500_00, method: "cash" },
      plan: { kind: "single", dueDate: todayDhaka() },
      confirmWarnings: true,
    });
    const saleId = created.ok ? created.value.saleId : "";
    const { rows } = await mods.db.execute<{ id: string; payment_id: string }>(sql`
      select i.id, a.payment_id from installments i join allocations a on a.installment_id = i.id where i.sale_id = ${saleId} and i.seq = 0`);
    const row = rows[0]!;

    await expectDbError(mods.db.execute(sql`insert into allocations (id, payment_id, installment_id, amount_minor) values (gen_random_uuid(), ${row.payment_id}, ${row.id}, 1)`), /over-allocation|exceed/);
    await expectDbError(mods.db.execute(sql`delete from payments where id = ${row.payment_id}`), /never deleted/);
    await expectDbError(mods.db.execute(sql`update activity_log set summary = 'x' where id in (select id from activity_log limit 1)`), /append-only/);

    // voiding removes allocations (trigger)
    await mods.db.execute(sql`update payments set status = 'voided', void_reason = 'test', voided_at = now() where id = ${row.payment_id}`);
    const left = await mods.db.execute<{ n: string }>(sql`select count(*) as n from allocations where payment_id = ${row.payment_id}`);
    expect(Number(left.rows[0]!.n)).toBe(0);
    await expectDbError(mods.db.execute(sql`update payments set status = 'active' where id = ${row.payment_id}`), /reactivated/);

    // tidy: cancel the test sale
    await new mods.CancelSale(mods.deps).execute({ saleId, reason: "integration test" });
  });

  it("collections and dashboard queries run", async () => {
    const col = await mods.queries.collections();
    expect(Array.isArray(col.overdue)).toBe(true);
    const dash = await mods.queries.dashboard();
    expect(dash.aging).toHaveLength(5);
    expect(dash.monthly).toHaveLength(6);
    const list = await mods.queries.listCustomers({ q: "পরীক্ষা", filter: "all", limit: 10, offset: 0 });
    expect(list.items.some((i) => i.id === customerId)).toBe(true);
    // phone search with Bangla digits
    const phone = (await mods.queries.customerProfile(customerId))!.customer.phone.slice(-6);
    const bnDigits = phone.replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);
    const byPhone = await mods.queries.listCustomers({ q: bnDigits, filter: "all", limit: 10, offset: 0 });
    expect(byPhone.items.some((i) => i.id === customerId)).toBe(true);
    // dashboard promise count follows the Today screen (pending only)
    expect(dash.promisesDueToday).toBe(col.promisesDueToday.length);
  });

  it("a due far in the future still shows on Today and Home; archived customers don't count", async () => {
    const phone = `+88018${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
    const c = await new mods.SaveCustomer({ uow: mods.deps.uow }).execute({ name: "Later Due Test", phone });
    if (!c.ok) throw new Error(JSON.stringify(c.error));
    const due = new Date(Date.now() + (6 + 24 * 30) * 3_600_000).toISOString().slice(0, 10); // ~30 days ahead (Dhaka)
    const sale = await new mods.CreateSale(mods.deps).execute({
      idempotencyKey: crypto.randomUUID(),
      customerId: c.value.id,
      items: [{ categoryId: null, name: "Earring", quantity: 1, unitPriceMinor: 7_000_00, customFields: {}, photos: [photo] }],
      discountMinor: 0,
      upfront: null,
      plan: { kind: "single", dueDate: due },
      confirmWarnings: true,
    });
    expect(sale.ok).toBe(true);

    const col = await mods.queries.collections();
    const later = col.later.find((r) => r.customerId === c.value.id);
    expect(later?.amountMinor).toBe(7_000_00);
    expect(later?.nextDueDate).toBe(due);
    const dash = await mods.queries.dashboard();
    expect(dash.upcoming.some((u) => u.customerId === c.value.id) || dash.upcoming.length === 10).toBe(true);

    // Archiving removes the customer from the lists AND the totals (they always agree).
    const before = dash.totalOutstandingMinor;
    await mods.db.execute(sql`update customers set archived_at = now() where id = ${c.value.id}`);
    const after = await mods.queries.dashboard();
    expect(after.totalOutstandingMinor).toBe(before - 7_000_00);
    expect((await mods.queries.collections()).later.some((r) => r.customerId === c.value.id)).toBe(false);
    if (sale.ok) await new mods.CancelSale(mods.deps).execute({ saleId: sale.value.saleId, reason: "integration test" });
  });

  it("clear data for a date range deletes the range + linked records and nothing else", async () => {
    const phone = `+88019${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
    const c = await new mods.SaveCustomer({ uow: mods.deps.uow }).execute({ name: "Clear Range Test", phone });
    if (!c.ok) throw new Error(JSON.stringify(c.error));
    const cid = c.value.id;
    const item = (name: string, price: number) => [{ categoryId: null, name, quantity: 1, unitPriceMinor: price, customFields: {}, photos: [photo] }];

    // In range: a sale dated 2020-01-05 …
    const old = await new mods.CreateSale(mods.deps).execute({
      idempotencyKey: crypto.randomUUID(),
      customerId: cid,
      saleDate: "2020-01-05",
      items: item("Old ring", 5_000_00),
      discountMinor: 0,
      upfront: null,
      plan: { kind: "single", dueDate: "2020-02-05" },
      confirmWarnings: true,
    });
    // … paid partly TODAY (outside the range, but linked → must go too).
    const oldId = old.ok ? old.value.saleId : "";
    const linkedPay = await new mods.ReceivePayment(mods.deps).execute({ idempotencyKey: crypto.randomUUID(), customerId: cid, amountMinor: 1_000_00, method: "cash", saleId: oldId });
    // Outside the range and unrelated: must survive untouched.
    const keep = await new mods.CreateSale(mods.deps).execute({
      idempotencyKey: crypto.randomUUID(),
      customerId: cid,
      items: item("New chain", 3_000_00),
      discountMinor: 0,
      upfront: null,
      plan: { kind: "single", dueDate: todayDhaka() },
      confirmWarnings: true,
    });
    expect(old.ok && linkedPay.ok && keep.ok).toBe(true);
    const keepId = keep.ok ? keep.value.saleId : "";

    const uc = new mods.ClearDateRange({ ...mods.deps, storage: mods.storage });
    const range = { from: "2020-01-01", to: "2020-01-31", removeEmptyCustomers: true };
    const preview = await uc.preview(range);
    expect(preview.ok && preview.value.sales).toBeGreaterThanOrEqual(1);
    expect(preview.ok && preview.value.linkedPayments).toBeGreaterThanOrEqual(1);

    const done = await uc.execute({ ...range, confirm: "DELETE" });
    expect(done.ok).toBe(true);
    expect(await mods.queries.saleDetail(oldId)).toBeNull();
    expect(await mods.queries.paymentDetail(linkedPay.ok ? linkedPay.value.paymentId : "")).toBeNull();
    expect((await mods.queries.saleDetail(keepId))?.remainingMinor).toBe(3_000_00);
    expect(await mods.queries.customerBalance(cid)).toBe(3_000_00);
    expect(mods.storage.deleted).toContain(photo.fileKey);

    // The guard is back on: ordinary deletes still fail, and the action was logged.
    await expectDbError(mods.db.execute(sql`delete from sales where id = ${keepId}`), /never deleted/);
    const log = await mods.queries.activity({ limit: 5, entity: "settings" });
    expect(log.some((a) => a.action === "data.cleared")).toBe(true);
    await new mods.CancelSale(mods.deps).execute({ saleId: keepId, reason: "integration test" });
  });

  it("report and export queries run", async () => {
    const range = { from: "2020-01-01", to: todayDhaka() };
    const r = mods.queries.reports;
    const [byDay, newCredit, aging, byCat, adj] = await Promise.all([
      r.collectionsByDay(range),
      r.newCreditSales(range),
      r.agingByCustomer(),
      r.outstandingByCategory(),
      r.adjustments(range),
    ]);
    expect(byDay.every((x) => x.amountMinor > 0)).toBe(true);
    expect(newCredit.some((s) => s.customerName === "Integration Test")).toBe(true);
    expect(Array.isArray(aging) && Array.isArray(byCat)).toBe(true);
    expect(adj.some((a) => a.reason === "test write off")).toBe(true);

    for (const table of mods.queries.exportableTables()) {
      const t = await mods.queries.exportTable(table);
      expect(t, table).not.toBeNull();
      expect(t!.columns.length, table).toBeGreaterThan(0);
    }
    expect(await mods.queries.exportTable("pg_user")).toBeNull();
    const users = await mods.queries.exportTable("users");
    expect(users!.columns.some((c) => /password|token|secret/i.test(c))).toBe(false);

    const activity = await mods.queries.activity({ limit: 5, entity: "payment" });
    expect(activity.every((a) => a.entity === "payment")).toBe(true);
  });
});
