import { beforeEach, describe, expect, it } from "vitest";
import { ApplyStarterSet, SaveField } from "@/application/use-cases/catalog/catalog";
import { SaveCustomer } from "@/application/use-cases/customers/customers";
import { LogFollowUp } from "@/application/use-cases/followups/log-follow-up";
import { CreateAdjustment, ReceivePayment, VoidPayment } from "@/application/use-cases/payments/payments";
import { CancelSale, CreateSale, UpdateSale, type CreateSaleInput } from "@/application/use-cases/sales/sales";
import { FakeClock } from "../../fakes";
import { InMemoryStore } from "../../fakes/in-memory-repos";

const photo = { fileKey: "item/2026-11/x.jpg", thumbKey: "item/2026-11/x_thumb.jpg" };

describe("money use cases", () => {
  let store: InMemoryStore;
  let clock: FakeClock;
  let deps: { uow: InMemoryStore; clock: FakeClock };
  let customerId: string;

  const saleInput = (over: Partial<CreateSaleInput> = {}): CreateSaleInput => ({
    idempotencyKey: crypto.randomUUID(),
    customerId,
    items: [{ categoryId: null, name: "Ring", quantity: 1, unitPriceMinor: 100_000_00, customFields: {}, photos: [photo] }],
    discountMinor: 0,
    upfront: null,
    plan: { kind: "single", dueDate: "2026-12-12" },
    ...over,
  });

  beforeEach(async () => {
    store = new InMemoryStore();
    clock = new FakeClock(new Date("2026-11-12T06:00:00Z")); // 12:00 in Dhaka
    deps = { uow: store, clock };
    const c = await new SaveCustomer({ uow: store }).execute({ name: "Rahim", nameBn: "রহিম", phone: "০১৭১২৩৪৫৬৭৮" });
    if (!c.ok) throw new Error("setup");
    customerId = c.value.id;
  });

  describe("customers", () => {
    it("normalizes the phone and detects duplicates", async () => {
      expect(store.customers[0]!.phone).toBe("+8801712345678");
      const dup = await new SaveCustomer({ uow: store }).execute({ name: "Other", phone: "+880 1712-345678" });
      expect(!dup.ok && dup.error).toEqual({ code: "DUPLICATE_PHONE", details: { existingId: customerId, existingName: "Rahim" } });
    });
  });

  describe("create sale", () => {
    it("creates a sale with numbered invoice, schedule and upfront payment", async () => {
      const r = await new CreateSale(deps).execute(
        saleInput({ discountMinor: 5_000_00, upfront: { amountMinor: 20_000_00, method: "bkash", reference: "TRX1" } }),
      );
      expect(r.ok).toBe(true);
      const sale = store.sales[0]!;
      expect(sale.saleNumber).toBe("INV-000001");
      expect(sale.totalMinor).toBe(95_000_00);
      expect(store.installments.map((i) => [i.seq, i.dueDate, i.amountMinor])).toEqual([
        [0, "2026-11-12", 20_000_00],
        [1, "2026-12-12", 75_000_00],
      ]);
      expect(store.payments[0]).toMatchObject({ receiptNumber: "RCP-000001", amountMinor: 20_000_00, isUpfront: true, reference: "TRX1" });
      expect(store.balance(customerId)).toBe(75_000_00);
      expect(store.activity.some((a) => a.action === "sale.created")).toBe(true);
    });

    it("is idempotent for a repeated key (double tap)", async () => {
      const input = saleInput();
      const a = await new CreateSale(deps).execute(input);
      const b = await new CreateSale(deps).execute(input);
      expect(a.ok && b.ok && a.value.saleId === b.value.saleId).toBe(true);
      expect(b.ok && b.value.created).toBe(false);
      expect(store.sales).toHaveLength(1);
    });

    it("warns about credit limit unless confirmed", async () => {
      store.customers[0]!.creditLimitMinor = 50_000_00;
      const r = await new CreateSale(deps).execute(saleInput());
      expect(!r.ok && r.error).toEqual({ code: "CREDIT_WARNING", details: { blocked: false, overLimit: true } });
      const ok = await new CreateSale(deps).execute(saleInput({ confirmWarnings: true }));
      expect(ok.ok).toBe(true);
    });

    it("validates category custom fields again in the domain", async () => {
      await new ApplyStarterSet(deps).execute({ apply: true });
      const gold = store.categories.find((c) => c.nameEn === "Gold")!;
      const bad = await new CreateSale(deps).execute(
        saleInput({ items: [{ categoryId: gold.id, name: "Bala", quantity: 1, unitPriceMinor: 100, customFields: { karat: "99K" }, photos: [photo] }] }),
      );
      expect(!bad.ok && bad.error.code).toBe("INVALID_CUSTOM_FIELDS");
      const good = await new CreateSale(deps).execute(
        saleInput({ items: [{ categoryId: gold.id, name: "Bala", quantity: 1, unitPriceMinor: 100, customFields: { karat: "22K", weight: "১১.৬৬" }, photos: [photo] }] }),
      );
      expect(good.ok).toBe(true);
      expect(store.items[0]!.customFields).toEqual({ karat: "22K", weight: 11.66 });
    });

    it("rolls back everything when a step fails", async () => {
      const before = { sales: store.sales.length, seq: store.seq.sale };
      store.repos(); // sanity
      const failing = new CreateSale({
        uow: { run: (work) => store.run((r) => work({ ...r, activity: { log: async () => { throw new Error("boom"); } } })) },
        clock,
      });
      await expect(failing.execute(saleInput())).rejects.toThrow("boom");
      expect(store.sales.length).toBe(before.sales);
      expect(store.seq.sale).toBe(before.seq);
    });
  });

  describe("receive payment", () => {
    beforeEach(async () => {
      await new CreateSale(deps).execute(saleInput({ plan: { kind: "installments", count: 2, frequency: "monthly", firstDate: "2026-11-12" } }));
    });

    it("allocates oldest-first and closes the sale when fully paid", async () => {
      const pay = new ReceivePayment(deps);
      const r1 = await pay.execute({ idempotencyKey: "k1", customerId, amountMinor: 60_000_00, method: "cash" });
      expect(r1.ok).toBe(true);
      expect(store.allocations.map((a) => a.amountMinor)).toEqual([50_000_00, 10_000_00]);
      expect(store.balance(customerId)).toBe(40_000_00);
      expect(store.payments[0]!.receiptNumber).toBe("RCP-000001");

      await pay.execute({ idempotencyKey: "k2", customerId, amountMinor: 40_000_00, method: "nagad" });
      expect(store.balance(customerId)).toBe(0);
      expect(store.sales[0]!.status).toBe("closed");
    });

    it("rejects overpayment", async () => {
      const r = await new ReceivePayment(deps).execute({ idempotencyKey: "k", customerId, amountMinor: 100_000_01, method: "cash" });
      expect(!r.ok && r.error).toEqual({ code: "OVERPAYMENT", details: { maxMinor: 100_000_00 } });
      expect(store.payments).toHaveLength(0);
    });

    it("can target one sale", async () => {
      await new CreateSale(deps).execute(saleInput());
      const second = store.sales[1]!;
      await new ReceivePayment(deps).execute({ idempotencyKey: "k", customerId, amountMinor: 1000, method: "cash", saleId: second.id });
      const inst = store.installments.find((i) => i.saleId === second.id)!;
      expect(store.paidOf(inst.id)).toBe(1000);
    });

    it("rejects future dates and stores past dates at noon Dhaka", async () => {
      const future = await new ReceivePayment(deps).execute({ idempotencyKey: "f", customerId, amountMinor: 1, method: "cash", date: "2026-11-13" });
      expect(!future.ok && future.error.code).toBe("INVALID_DATE");
      await new ReceivePayment(deps).execute({ idempotencyKey: "p", customerId, amountMinor: 1, method: "cash", date: "2026-11-01" });
      expect(store.payments[0]!.paidAt.toISOString()).toBe("2026-11-01T06:00:00.000Z");
    });
  });

  describe("void payment", () => {
    it("removes allocations, reopens the sale, keeps the record", async () => {
      await new CreateSale(deps).execute(saleInput());
      const r = await new ReceivePayment(deps).execute({ idempotencyKey: "k", customerId, amountMinor: 100_000_00, method: "cash" });
      expect(store.sales[0]!.status).toBe("closed");
      const paymentId = r.ok ? r.value.paymentId : "";
      const noReason = await new VoidPayment(deps).execute({ paymentId, reason: "" });
      expect(!noReason.ok && noReason.error.code).toBe("REASON_REQUIRED");
      await new VoidPayment(deps).execute({ paymentId, reason: "wrong customer" });
      expect(store.payments[0]).toMatchObject({ status: "voided", voidReason: "wrong customer" });
      expect(store.allocations).toHaveLength(0);
      expect(store.sales[0]!.status).toBe("open");
      expect(store.balance(customerId)).toBe(100_000_00);
      const again = await new VoidPayment(deps).execute({ paymentId, reason: "again" });
      expect(!again.ok && again.error.code).toBe("ALREADY_VOIDED");
    });
  });

  describe("adjustments", () => {
    it("opening balance creates an obligation that payments can settle", async () => {
      await new CreateAdjustment(deps).execute({ customerId, type: "opening_balance", amountMinor: 5_000_00, reason: "old khata page 12", dueDate: "2026-10-01" });
      expect(store.balance(customerId)).toBe(5_000_00);
      await new ReceivePayment(deps).execute({ idempotencyKey: "k", customerId, amountMinor: 2_000_00, method: "cash" });
      expect(store.balance(customerId)).toBe(3_000_00);
    });

    it("write-off settles the sale as written_off; credits can't exceed balance", async () => {
      await new CreateSale(deps).execute(saleInput());
      const tooBig = await new CreateAdjustment(deps).execute({ customerId, type: "discount", amountMinor: 100_000_01, reason: "too much" });
      expect(!tooBig.ok && tooBig.error.code).toBe("OVERPAYMENT");
      await new CreateAdjustment(deps).execute({ customerId, type: "write_off", amountMinor: 100_000_00, reason: "customer left town" });
      expect(store.balance(customerId)).toBe(0);
      expect(store.sales[0]!.status).toBe("written_off");
    });

    it("requires a reason", async () => {
      const r = await new CreateAdjustment(deps).execute({ customerId, type: "return", amountMinor: 1, reason: " " });
      expect(!r.ok && r.error.code).toBe("REASON_REQUIRED");
    });
  });

  describe("edit and cancel sale", () => {
    it("edits while only the upfront payment exists, then refuses", async () => {
      const created = await new CreateSale(deps).execute(saleInput({ upfront: { amountMinor: 10_000_00, method: "cash" } }));
      const saleId = created.ok ? created.value.saleId : "";
      const update = new UpdateSale(deps);
      const r = await update.execute({
        saleId,
        items: [{ categoryId: null, name: "Ring 2", quantity: 1, unitPriceMinor: 80_000_00, customFields: {}, photos: [photo] }],
        discountMinor: 0,
        plan: { kind: "single", dueDate: "2027-01-12" },
      });
      expect(r.ok).toBe(true);
      expect(store.sales[0]!.totalMinor).toBe(80_000_00);
      expect(store.balance(customerId)).toBe(70_000_00);

      await new ReceivePayment(deps).execute({ idempotencyKey: "k", customerId, amountMinor: 1, method: "cash" });
      const blocked = await update.execute({ saleId, items: [], discountMinor: 0, plan: { kind: "single", dueDate: "2027-01-12" } });
      expect(!blocked.ok && blocked.error.code).toBe("SALE_NOT_EDITABLE");
    });

    it("cancels only without payments, and cancelled sales leave the balance", async () => {
      const created = await new CreateSale(deps).execute(saleInput());
      const saleId = created.ok ? created.value.saleId : "";
      await new CancelSale(deps).execute({ saleId, reason: "customer changed mind" });
      expect(store.sales[0]!.status).toBe("cancelled");
      expect(store.balance(customerId)).toBe(0);
    });
  });

  describe("follow-ups and fields", () => {
    it("promise needs a date not in the past", async () => {
      const log = new LogFollowUp(deps);
      const bad = await log.execute({ customerId, channel: "call", outcome: "promised", promisedDate: "2026-11-11" });
      expect(!bad.ok && bad.error.code).toBe("INVALID_DATE");
      const good = await log.execute({ customerId, channel: "whatsapp", outcome: "promised", promisedDate: "2026-11-15", promisedAmountMinor: 500_00 });
      expect(good.ok).toBe(true);
    });

    it("field key is unique within scope and immutable", async () => {
      const save = new SaveField(deps);
      const a = await save.execute({ categoryId: null, key: "weight", labelEn: "Weight", type: "decimal" });
      expect(a.ok).toBe(true);
      const dup = await save.execute({ categoryId: null, key: "weight", labelEn: "Weight 2", type: "text" });
      expect(!dup.ok && dup.error.code).toBe("DUPLICATE_FIELD_KEY");
      const id = a.ok ? a.value.id : "";
      await save.execute({ id, categoryId: null, key: "changed", labelEn: "Wt", type: "text" });
      expect(store.fields[0]).toMatchObject({ key: "weight", type: "decimal", labelEn: "Wt" });
    });
  });
});
