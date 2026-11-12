import { eq, sql, type SQL } from "drizzle-orm";
import type {
  ActivityRow,
  AppliedCredit,
  CollectionRow,
  CollectionsView,
  CustomerFilter,
  DashboardView,
  DateRange,
  FollowUpView,
  InstallmentView,
  LedgerEntry,
  PromiseRow,
  Queries,
} from "@/application/ports/queries";
import type { FollowUpRecord } from "@/application/ports/records";
import { agingBucket, AGING_BUCKETS, installmentStatus, type AgingBucket } from "@/domain/collections/aging";
import { promiseStatus } from "@/domain/followup/follow-up";
import type { AdjustmentType, PaymentMethod } from "@/domain/payment/payment";
import { canCancelSale, canEditSale } from "@/domain/sale/sale";
import { toLatinDigits } from "@/domain/shared/digits";
import { ShopDate } from "@/domain/shared/shop-date";
import type { Database } from "../db/client";
import { customers, payments, sales } from "../db/schema";
import { loadItems, toAdjustment, toCustomer, toPayment, toSale } from "../repositories/drizzle-repos";

const TODAY = sql.raw(`(now() at time zone 'Asia/Dhaka')::date`);
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const dateOrNull = (v: unknown) => (v ? new Date(v as string) : null);

const EXPORT_TABLES = [
  "settings",
  "sequences",
  "categories",
  "field_definitions",
  "customers",
  "sales",
  "sale_items",
  "sale_item_photos",
  "installments",
  "payments",
  "adjustments",
  "allocations",
  "follow_ups",
  "translation_overrides",
  "activity_log",
  "users",
] as const;

export class DrizzleQueries implements Queries {
  constructor(private readonly db: Database) {}

  private async rows<T>(q: SQL): Promise<T[]> {
    return (await this.db.execute(q)).rows as T[];
  }

  private today(): ShopDate {
    return ShopDate.fromInstant(new Date());
  }

  /* ---------------- customers ---------------- */

  async listCustomers(input: { q?: string; filter: CustomerFilter; limit: number; offset: number }) {
    const conds: SQL[] = [];
    switch (input.filter) {
      case "archived":
        conds.push(sql`c.archived_at is not null`);
        break;
      case "blocked":
        conds.push(sql`c.is_blocked and c.archived_at is null`);
        break;
      case "has_dues":
        conds.push(sql`cb.balance_minor > 0 and c.archived_at is null`);
        break;
      case "overdue":
        conds.push(sql`cb.overdue_minor > 0 and c.archived_at is null`);
        break;
      default:
        conds.push(sql`c.archived_at is null`);
    }
    const q = toLatinDigits(input.q ?? "").trim();
    let order = sql`cb.overdue_minor desc, cb.balance_minor desc, c.name asc`;
    if (q) {
      const like = `%${q}%`;
      const digits = q.replace(/\D/g, "");
      const phoneCond = digits.length >= 3 ? sql` or c.phone like ${`%${digits}%`}` : sql``;
      conds.push(sql`(c.name ilike ${like} or c.name_bn ilike ${like} or c.name % ${q} or c.name_bn % ${q}${phoneCond})`);
      order = sql`greatest(similarity(c.name, ${q}), similarity(coalesce(c.name_bn, ''), ${q})) desc, c.name asc`;
    }
    const where = sql.join(conds, sql` and `);
    const rows = await this.rows<Record<string, unknown>>(sql`
      select c.id, c.name, c.name_bn, c.phone, c.photo_thumb_key, c.is_blocked, (c.archived_at is not null) as archived,
             cb.balance_minor, cb.overdue_minor, cb.max_days_overdue, cb.last_payment_at,
             count(*) over () as total
      from customers c join customer_balances cb on cb.customer_id = c.id
      where ${where}
      order by ${order}
      limit ${input.limit} offset ${input.offset}`);
    return {
      total: num(rows[0]?.total),
      items: rows.map((r) => ({
        id: r.id as string,
        name: r.name as string,
        nameBn: (r.name_bn as string) ?? null,
        phone: r.phone as string,
        photoThumbKey: (r.photo_thumb_key as string) ?? null,
        isBlocked: Boolean(r.is_blocked),
        archived: Boolean(r.archived),
        balanceMinor: num(r.balance_minor),
        overdueMinor: num(r.overdue_minor),
        maxDaysOverdue: num(r.max_days_overdue),
        lastPaymentAt: dateOrNull(r.last_payment_at),
      })),
    };
  }

  async customerBalance(id: string) {
    const [r] = await this.rows<{ b: string }>(sql`select balance_minor as b from customer_balances where customer_id = ${id}`);
    return num(r?.b);
  }

  async customerProfile(id: string) {
    const [c] = await this.db.select().from(customers).where(eq(customers.id, id));
    if (!c) return null;
    const [b] = await this.rows<Record<string, unknown>>(sql`select * from customer_balances where customer_id = ${id}`);
    const saleRows = await this.rows<Record<string, unknown>>(sql`
      select s.id, s.sale_number, s.sale_date::text as sale_date, s.total_minor, s.status,
             sb.remaining_minor, sb.max_days_overdue, sb.next_due_date::text as next_due_date
      from sales s join sale_balances sb on sb.sale_id = s.id
      where s.customer_id = ${id} and sb.remaining_minor > 0
      order by sb.next_due_date asc nulls last, s.sale_date asc`);
    const items = await loadItems(this.db, saleRows.map((s) => s.id as string));
    return {
      customer: toCustomer(c),
      balanceMinor: num(b?.balance_minor),
      overdueMinor: num(b?.overdue_minor),
      maxDaysOverdue: num(b?.max_days_overdue),
      lastPaymentAt: dateOrNull(b?.last_payment_at),
      openSales: saleRows.map((s) => ({
        id: s.id as string,
        saleNumber: s.sale_number as string,
        saleDate: s.sale_date as string,
        totalMinor: num(s.total_minor),
        remainingMinor: num(s.remaining_minor),
        maxDaysOverdue: num(s.max_days_overdue),
        nextDueDate: (s.next_due_date as string) ?? null,
        status: s.status as never,
        items: items
          .filter((i) => i.saleId === s.id)
          .map((i) => ({ name: i.name, thumbKey: i.photos[0]?.thumbKey ?? null })),
      })),
    };
  }

  async customerLedger(id: string, range?: DateRange) {
    const rows = await this.rows<Record<string, unknown>>(sql`
      select * from (
        select 'sale' as kind, s.id as ref_id, s.sale_number as ref, null::text as detail,
               ((s.sale_date + (s.created_at at time zone 'Asia/Dhaka')::time) at time zone 'Asia/Dhaka') as at,
               case when s.status = 'cancelled' then 0 else s.total_minor end as debit, 0::bigint as credit,
               false as voided, (s.status = 'cancelled') as cancelled
        from sales s where s.customer_id = ${id}
        union all
        select 'payment', p.id, p.receipt_number, p.method, p.paid_at,
               0, case when p.status = 'voided' then 0 else p.amount_minor end,
               (p.status = 'voided'), false
        from payments p where p.customer_id = ${id}
        union all
        select 'adjustment', a.id, a.type, a.type, a.created_at,
               case when a.direction = 'debit' then a.amount_minor else 0 end,
               case when a.direction = 'credit' then a.amount_minor else 0 end,
               false, false
        from adjustments a where a.customer_id = ${id}
      ) x order by at asc, kind desc`);
    let balance = 0;
    let opening = 0;
    const entries: LedgerEntry[] = [];
    for (const r of rows) {
      const at = new Date(r.at as string);
      const debit = num(r.debit);
      const credit = num(r.credit);
      balance += debit - credit;
      const day = ShopDate.fromInstant(at).iso;
      if (range && day < range.from) {
        opening = balance;
        continue;
      }
      if (range && day > range.to) continue;
      entries.push({
        at,
        kind: r.kind as LedgerEntry["kind"],
        refId: r.ref_id as string,
        ref: r.ref as string,
        detail: (r.detail as string) ?? null,
        debitMinor: debit,
        creditMinor: credit,
        balanceMinor: balance,
        voided: Boolean(r.voided),
        cancelled: Boolean(r.cancelled),
      });
    }
    return { openingBalanceMinor: range ? opening : 0, entries };
  }

  async customerFollowUps(id: string): Promise<FollowUpView[]> {
    const rows = await this.rows<Record<string, unknown>>(sql`
      select f.id, f.customer_id, f.sale_id, f.channel, f.outcome, f.note, f.promised_amount_minor,
             f.promised_date::text as promised_date, f.created_at,
             coalesce((select sum(p.amount_minor) from payments p
                       where p.customer_id = f.customer_id and p.status = 'active' and p.paid_at >= f.created_at
                         and (p.paid_at at time zone 'Asia/Dhaka')::date <= f.promised_date), 0) as paid_toward
      from follow_ups f where f.customer_id = ${id}
      order by f.created_at desc limit 100`);
    const today = this.today();
    return rows.map((r) => this.toFollowUp(r, today));
  }

  private toFollowUp(r: Record<string, unknown>, today: ShopDate): FollowUpView {
    const promisedDate = (r.promised_date as string) ?? null;
    const paidToward = num(r.paid_toward);
    const promisedAmount = r.promised_amount_minor === null || r.promised_amount_minor === undefined ? null : num(r.promised_amount_minor);
    return {
      id: r.id as string,
      customerId: r.customer_id as string,
      saleId: (r.sale_id as string) ?? null,
      channel: r.channel as FollowUpRecord["channel"],
      outcome: r.outcome as FollowUpRecord["outcome"],
      note: (r.note as string) ?? null,
      promisedAmountMinor: promisedAmount,
      promisedDate,
      createdAt: new Date(r.created_at as string),
      paidTowardMinor: paidToward,
      promiseStatus:
        r.outcome === "promised" && promisedDate
          ? promiseStatus({ promisedDate: ShopDate.of(promisedDate), promisedAmountMinor: promisedAmount, paidTowardMinor: paidToward, today })
          : null,
    };
  }

  async customerOpenInstallments(id: string) {
    const rows = await this.rows<Record<string, unknown>>(sql`
      select ib.id, ib.seq, ib.due_date::text as due_date, ib.amount_minor, ib.paid_minor, ib.remaining_minor,
             ib.status, ib.days_overdue, ib.sale_id, s.sale_number
      from installment_balances ib left join sales s on s.id = ib.sale_id
      where ib.customer_id = ${id} and ib.remaining_minor > 0
      order by ib.due_date asc, ib.seq asc`);
    return rows.map((r) => ({ ...this.toInstallment(r), saleId: (r.sale_id as string) ?? null, saleNumber: (r.sale_number as string) ?? null }));
  }

  private toInstallment(r: Record<string, unknown>): InstallmentView {
    return {
      id: r.id as string,
      seq: num(r.seq),
      dueDate: r.due_date as string,
      amountMinor: num(r.amount_minor),
      paidMinor: num(r.paid_minor),
      remainingMinor: num(r.remaining_minor),
      status: r.status as InstallmentView["status"],
      daysOverdue: num(r.days_overdue),
    };
  }

  async customerAdjustments(id: string) {
    const rows = await this.rows<Record<string, unknown>>(sql`
      select a.*, s.sale_number from adjustments a left join sales s on s.id = a.sale_id
      where a.customer_id = ${id} order by a.created_at desc`);
    return rows.map((r) => ({
      id: r.id as string,
      customerId: r.customer_id as string,
      saleId: (r.sale_id as string) ?? null,
      type: r.type as AdjustmentType,
      direction: r.direction as "debit" | "credit",
      amountMinor: num(r.amount_minor),
      reason: r.reason as string,
      createdAt: new Date(r.created_at as string),
      saleNumber: (r.sale_number as string) ?? null,
    }));
  }

  /* ---------------- sales & payments ---------------- */

  async saleDetail(id: string) {
    const [s] = await this.db.select().from(sales).where(eq(sales.id, id));
    if (!s) return null;
    const [c] = await this.db.select().from(customers).where(eq(customers.id, s.customerId));
    const items = await loadItems(this.db, [id]);
    const instRows = await this.rows<Record<string, unknown>>(sql`
      select i.id, i.seq, i.due_date::text as due_date, i.amount_minor,
             coalesce((select sum(a.amount_minor) from allocations a where a.installment_id = i.id), 0) as paid_minor
      from installments i where i.sale_id = ${id} order by i.seq`);
    const today = this.today();
    const installments: InstallmentView[] = instRows.map((r) => {
      const st = installmentStatus({ amountMinor: num(r.amount_minor), paidMinor: num(r.paid_minor), dueDate: ShopDate.of(r.due_date as string), today });
      return {
        id: r.id as string,
        seq: num(r.seq),
        dueDate: r.due_date as string,
        amountMinor: num(r.amount_minor),
        paidMinor: num(r.paid_minor),
        remainingMinor: s.status === "cancelled" ? 0 : st.remainingMinor,
        status: st.status,
        daysOverdue: s.status === "cancelled" ? 0 : st.daysOverdue,
      };
    });
    const appliedRows = await this.rows<Record<string, unknown>>(sql`
      select 'payment' as kind, p.id, p.receipt_number as ref, p.paid_at as at, p.method, null::text as adj_type,
             sum(a.amount_minor) as amount, p.is_upfront
      from allocations a join installments i on i.id = a.installment_id join payments p on p.id = a.payment_id
      where i.sale_id = ${id} group by p.id
      union all
      select 'adjustment', ad.id, ad.type, ad.created_at, null, ad.type, sum(a.amount_minor), false
      from allocations a join installments i on i.id = a.installment_id join adjustments ad on ad.id = a.adjustment_id
      where i.sale_id = ${id} group by ad.id
      order by at asc`);
    const applied: AppliedCredit[] = appliedRows.map((r) => ({
      kind: r.kind as AppliedCredit["kind"],
      id: r.id as string,
      ref: r.ref as string,
      at: new Date(r.at as string),
      method: (r.method as PaymentMethod) ?? null,
      adjustmentType: (r.adj_type as AdjustmentType) ?? null,
      amountMinor: num(r.amount),
      isUpfront: Boolean(r.is_upfront),
    }));
    const paidMinor = applied.reduce((sum, a) => sum + a.amountMinor, 0);
    const sale = toSale(s);
    const afterUpfront = applied.some((a) => a.kind === "adjustment" || !a.isUpfront);
    return {
      sale: { ...sale, createdAt: s.createdAt },
      customer: { id: c!.id, name: c!.name, nameBn: c!.nameBn, phone: c!.phone, photoThumbKey: c!.photoThumbKey },
      items,
      installments,
      applied,
      paidMinor,
      remainingMinor: sale.status === "cancelled" ? 0 : sale.totalMinor - paidMinor,
      editable: canEditSale(sale, afterUpfront),
      cancellable: canCancelSale(sale, applied.length > 0),
    };
  }

  async paymentDetail(id: string) {
    const [p] = await this.db.select().from(payments).where(eq(payments.id, id));
    if (!p) return null;
    const [c] = await this.db.select().from(customers).where(eq(customers.id, p.customerId));
    const allocs = await this.rows<Record<string, unknown>>(sql`
      select i.sale_id, s.sale_number, i.seq, i.due_date::text as due_date, a.amount_minor
      from allocations a join installments i on i.id = a.installment_id left join sales s on s.id = i.sale_id
      where a.payment_id = ${id} order by i.due_date, i.seq`);
    return {
      payment: toPayment(p),
      customer: { id: c!.id, name: c!.name, nameBn: c!.nameBn, phone: c!.phone },
      allocations: allocs.map((a) => ({
        saleId: (a.sale_id as string) ?? null,
        saleNumber: (a.sale_number as string) ?? null,
        seq: num(a.seq),
        dueDate: a.due_date as string,
        amountMinor: num(a.amount_minor),
      })),
      customerBalanceMinor: await this.customerBalance(c!.id),
    };
  }

  /* ---------------- collections & dashboard ---------------- */

  private async customersWithDues(): Promise<CollectionRow[]> {
    const rows = await this.rows<Record<string, unknown>>(sql`
      select c.id, c.name, c.name_bn, c.phone, c.photo_thumb_key,
             cb.balance_minor, cb.overdue_minor, cb.max_days_overdue, cb.next_due_date::text as next_due_date,
             (select sip.thumb_key from sales s
                join sale_items si on si.sale_id = s.id
                join sale_item_photos sip on sip.sale_item_id = si.id
              where s.customer_id = c.id and s.status = 'open'
              order by s.sale_date desc, si.sort_order, sip.sort_order limit 1) as product_thumb,
             lf.created_at as lf_at, lf.outcome as lf_outcome
      from customers c
      join customer_balances cb on cb.customer_id = c.id
      left join lateral (select f.created_at, f.outcome from follow_ups f where f.customer_id = c.id
                         order by f.created_at desc limit 1) lf on true
      where c.archived_at is null and cb.balance_minor > 0`);
    return rows.map((r) => ({
      customerId: r.id as string,
      name: r.name as string,
      nameBn: (r.name_bn as string) ?? null,
      phone: r.phone as string,
      photoThumbKey: (r.photo_thumb_key as string) ?? null,
      productThumbKey: (r.product_thumb as string) ?? null,
      balanceMinor: num(r.balance_minor),
      amountMinor: num(r.overdue_minor),
      maxDaysOverdue: num(r.max_days_overdue),
      nextDueDate: (r.next_due_date as string) ?? null,
      bucket: agingBucket(num(r.max_days_overdue)),
      lastFollowUp: r.lf_at ? { at: new Date(r.lf_at as string), outcome: r.lf_outcome as FollowUpRecord["outcome"] } : null,
    }));
  }

  /** Per customer: the next due date that is today or later, and the amount due on it. */
  private async nextDue(): Promise<Map<string, { due: string; amount: number }>> {
    const rows = await this.rows<{ customer_id: string; amount: string; due: string }>(sql`
      select customer_id, due_date::text as due, sum(remaining_minor) as amount
      from installment_balances
      where remaining_minor > 0 and due_date >= ${TODAY}
      group by customer_id, due_date
      order by customer_id, due_date`);
    const out = new Map<string, { due: string; amount: number }>();
    for (const r of rows) if (!out.has(r.customer_id)) out.set(r.customer_id, { due: r.due, amount: num(r.amount) });
    return out;
  }

  async collections(): Promise<CollectionsView> {
    const base = await this.customersWithDues();
    const byId = new Map(base.map((b) => [b.customerId, b]));
    const next = await this.nextDue();
    const today = this.today();
    const weekEnd = today.addDays(7).iso;

    // Latest promise per customer (made within the last 60 days).
    const promiseRows = await this.rows<Record<string, unknown>>(sql`
      select distinct on (f.customer_id)
             f.id, f.customer_id, f.sale_id, f.channel, f.outcome, f.note, f.promised_amount_minor,
             f.promised_date::text as promised_date, f.created_at,
             coalesce((select sum(p.amount_minor) from payments p
                       where p.customer_id = f.customer_id and p.status = 'active' and p.paid_at >= f.created_at
                         and (p.paid_at at time zone 'Asia/Dhaka')::date <= f.promised_date), 0) as paid_toward
      from follow_ups f
      where f.outcome = 'promised' and f.promised_date >= ${TODAY} - 60
      order by f.customer_id, f.created_at desc`);
    const promises: PromiseRow[] = [];
    for (const r of promiseRows) {
      const fu = this.toFollowUp(r, today);
      const cust = byId.get(fu.customerId);
      if (!cust || !fu.promisedDate || !fu.promiseStatus) continue;
      promises.push({
        ...cust,
        followUpId: fu.id,
        promisedDate: fu.promisedDate,
        promisedAmountMinor: fu.promisedAmountMinor,
        paidTowardMinor: fu.paidTowardMinor,
        status: fu.promiseStatus,
      });
    }

    const byPriority = (a: CollectionRow, b: CollectionRow) =>
      b.amountMinor * Math.max(1, b.maxDaysOverdue) - a.amountMinor * Math.max(1, a.maxDaysOverdue);

    const withNext = (b: CollectionRow) => {
      const n = next.get(b.customerId)!;
      return { ...b, amountMinor: n.amount, nextDueDate: n.due };
    };
    const byDue = (a: CollectionRow, b: CollectionRow) => (a.nextDueDate ?? "").localeCompare(b.nextDueDate ?? "");

    const promisesDueToday = promises.filter((p) => p.promisedDate === today.iso && p.status === "pending");
    const brokenPromises = promises.filter((p) => p.status === "broken").sort((a, b) => a.promisedDate.localeCompare(b.promisedDate));
    const dueToday = base.filter((b) => next.get(b.customerId)?.due === today.iso).map(withNext);
    const overdue = base.filter((b) => b.amountMinor > 0).sort(byPriority);
    const upcoming = base
      .filter((b) => {
        const d = next.get(b.customerId)?.due;
        return d !== undefined && d > today.iso && d <= weekEnd;
      })
      .map(withNext)
      .sort(byDue);
    // Everyone else who owes money (next due date more than 7 days away): never hidden.
    const shown = new Set([...promisesDueToday, ...brokenPromises, ...dueToday, ...overdue, ...upcoming].map((r) => r.customerId));
    const later = base
      .filter((b) => !shown.has(b.customerId) && next.has(b.customerId))
      .map(withNext)
      .sort(byDue);

    return { promisesDueToday, brokenPromises, dueToday, overdue, upcoming, later };
  }

  async dashboard(): Promise<DashboardView> {
    const [totals] = await this.rows<Record<string, unknown>>(sql`
      select coalesce(sum(cb.balance_minor), 0) as outstanding,
             coalesce(sum(cb.overdue_minor), 0) as overdue,
             count(*) filter (where cb.balance_minor > 0) as with_dues
      from customer_balances cb join customers c on c.id = cb.customer_id
      where c.archived_at is null`);
    const [collected] = await this.rows<Record<string, unknown>>(sql`
      select coalesce(sum(amount_minor) filter (where (paid_at at time zone 'Asia/Dhaka')::date = ${TODAY}), 0) as today,
             coalesce(sum(amount_minor) filter (where (paid_at at time zone 'Asia/Dhaka')::date >= date_trunc('month', ${TODAY})::date), 0) as month
      from payments where status = 'active'`);
    const [credit] = await this.rows<Record<string, unknown>>(sql`
      select coalesce(sum(i.amount_minor), 0) as month
      from installments i join sales s on s.id = i.sale_id
      where i.seq >= 1 and s.status <> 'cancelled' and s.sale_date >= date_trunc('month', ${TODAY})::date`);
    const agingRows = await this.rows<{ bucket: AgingBucket; amount: string }>(sql`
      select case
               when ib.days_overdue <= 0 then 'not_due'
               when ib.days_overdue <= 30 then 'd1_30'
               when ib.days_overdue <= 60 then 'd31_60'
               when ib.days_overdue <= 90 then 'd61_90'
               else 'd90_plus' end as bucket,
             sum(ib.remaining_minor) as amount
      from installment_balances ib join customers c on c.id = ib.customer_id
      where ib.remaining_minor > 0 and c.archived_at is null group by 1`);
    const monthly = await this.rows<Record<string, unknown>>(sql`
      with months as (
        select generate_series(date_trunc('month', ${TODAY}) - interval '5 months', date_trunc('month', ${TODAY}), interval '1 month')::date as m
      )
      select to_char(m, 'YYYY-MM') as month,
        coalesce((select sum(p.amount_minor) from payments p where p.status = 'active'
                  and date_trunc('month', p.paid_at at time zone 'Asia/Dhaka')::date = m), 0) as collected,
        coalesce((select sum(i.amount_minor) from installments i join sales s on s.id = i.sale_id
                  where i.seq >= 1 and s.status <> 'cancelled' and date_trunc('month', s.sale_date)::date = m), 0) as new_credit
      from months order by m`);
    const col = await this.collections();
    return {
      totalOutstandingMinor: num(totals?.outstanding),
      totalOverdueMinor: num(totals?.overdue),
      customersWithDues: num(totals?.with_dues),
      collectedTodayMinor: num(collected?.today),
      collectedMonthMinor: num(collected?.month),
      newCreditMonthMinor: num(credit?.month),
      // Same rule as the Today screen: only promises still pending today.
      promisesDueToday: col.promisesDueToday.length,
      aging: AGING_BUCKETS.map((bucket) => ({ bucket, amountMinor: num(agingRows.find((a) => a.bucket === bucket)?.amount) })),
      monthly: monthly.map((m) => ({ month: m.month as string, collectedMinor: num(m.collected), newCreditMinor: num(m.new_credit) })),
      topOverdue: col.overdue.slice(0, 10),
      upcoming: [...col.dueToday, ...col.upcoming, ...col.later].slice(0, 10).map((u) => ({ ...u, dueDate: u.nextDueDate ?? "" })),
    };
  }

  /* ---------------- reports ---------------- */

  reports = {
    collectionsByDay: async (range: DateRange) => {
      const rows = await this.rows<Record<string, unknown>>(sql`
        select (paid_at at time zone 'Asia/Dhaka')::date::text as day, method, count(*) as n, sum(amount_minor) as amount
        from payments
        where status = 'active' and (paid_at at time zone 'Asia/Dhaka')::date between ${range.from}::date and ${range.to}::date
        group by 1, 2 order by 1, 2`);
      return rows.map((r) => ({ day: r.day as string, method: r.method as PaymentMethod, count: num(r.n), amountMinor: num(r.amount) }));
    },
    newCreditSales: async (range: DateRange) => {
      const rows = await this.rows<Record<string, unknown>>(sql`
        select s.id, s.sale_number, s.sale_date::text as sale_date, c.name, s.total_minor, s.status,
               coalesce(sb.remaining_minor, 0) as remaining
        from sales s join customers c on c.id = s.customer_id left join sale_balances sb on sb.sale_id = s.id
        where s.sale_date between ${range.from}::date and ${range.to}::date
        order by s.sale_date, s.sale_number`);
      return rows.map((r) => ({
        saleId: r.id as string,
        saleNumber: r.sale_number as string,
        saleDate: r.sale_date as string,
        customerName: r.name as string,
        totalMinor: num(r.total_minor),
        remainingMinor: num(r.remaining),
        status: r.status as never,
      }));
    },
    agingByCustomer: async () => {
      const rows = await this.rows<Record<string, unknown>>(sql`
        select c.id, c.name, c.phone,
          sum(ib.remaining_minor) as total,
          sum(ib.remaining_minor) filter (where ib.days_overdue <= 0) as not_due,
          sum(ib.remaining_minor) filter (where ib.days_overdue between 1 and 30) as d1_30,
          sum(ib.remaining_minor) filter (where ib.days_overdue between 31 and 60) as d31_60,
          sum(ib.remaining_minor) filter (where ib.days_overdue between 61 and 90) as d61_90,
          sum(ib.remaining_minor) filter (where ib.days_overdue > 90) as d90_plus
        from installment_balances ib join customers c on c.id = ib.customer_id
        where ib.remaining_minor > 0
        group by c.id order by total desc`);
      return rows.map((r) => ({
        customerId: r.id as string,
        name: r.name as string,
        phone: r.phone as string,
        totalMinor: num(r.total),
        not_due: num(r.not_due),
        d1_30: num(r.d1_30),
        d31_60: num(r.d31_60),
        d61_90: num(r.d61_90),
        d90_plus: num(r.d90_plus),
      }));
    },
    outstandingByCategory: async () => {
      // A sale's remaining balance is attributed to its items in proportion to their line totals.
      const rows = await this.rows<Record<string, unknown>>(sql`
        select coalesce(p.id, cat.id) as category_id, coalesce(p.name_bn, cat.name_bn) as name_bn, coalesce(p.name_en, cat.name_en) as name_en,
               round(sum(sb.remaining_minor::numeric * si.line_total_minor / nullif(s.subtotal_minor, 0)))::bigint as outstanding
        from sale_balances sb
        join sales s on s.id = sb.sale_id
        join sale_items si on si.sale_id = s.id
        left join categories cat on cat.id = si.category_id
        left join categories p on p.id = cat.parent_id
        where sb.remaining_minor > 0
        group by 1, 2, 3 order by outstanding desc`);
      return rows.map((r) => ({
        categoryId: (r.category_id as string) ?? null,
        nameBn: (r.name_bn as string) ?? null,
        nameEn: (r.name_en as string) ?? null,
        outstandingMinor: num(r.outstanding),
      }));
    },
    adjustments: async (range: DateRange) => {
      const rows = await this.rows<Record<string, unknown>>(sql`
        select a.*, s.sale_number, c.name as customer_name
        from adjustments a join customers c on c.id = a.customer_id left join sales s on s.id = a.sale_id
        where (a.created_at at time zone 'Asia/Dhaka')::date between ${range.from}::date and ${range.to}::date
        order by a.created_at`);
      return rows.map((r) => ({
        id: r.id as string,
        customerId: r.customer_id as string,
        saleId: (r.sale_id as string) ?? null,
        type: r.type as AdjustmentType,
        direction: r.direction as "debit" | "credit",
        amountMinor: num(r.amount_minor),
        reason: r.reason as string,
        createdAt: new Date(r.created_at as string),
        saleNumber: (r.sale_number as string) ?? null,
        customerName: r.customer_name as string,
      }));
    },
  };

  /* ---------------- activity & export ---------------- */

  async activity(input: { limit: number; before?: Date; entity?: string }): Promise<ActivityRow[]> {
    const conds: SQL[] = [sql`true`];
    if (input.before) conds.push(sql`at < ${input.before}`);
    if (input.entity) conds.push(sql`entity = ${input.entity}`);
    const rows = await this.rows<Record<string, unknown>>(sql`
      select id, action, entity, entity_id, summary, before, after, at from activity_log
      where ${sql.join(conds, sql` and `)} order by at desc limit ${input.limit}`);
    return rows.map((r) => ({
      id: r.id as string,
      action: r.action as string,
      entity: r.entity as string,
      entityId: (r.entity_id as string) ?? null,
      summary: r.summary as string,
      before: r.before,
      after: r.after,
      at: new Date(r.at as string),
    }));
  }

  exportableTables() {
    return EXPORT_TABLES;
  }

  async exportTable(table: string) {
    if (!(EXPORT_TABLES as readonly string[]).includes(table)) return null;
    // users: never export auth internals beyond identity
    const q =
      table === "users"
        ? sql`select id, name, email, locale, created_at, updated_at from users order by created_at`
        : sql`select * from ${sql.identifier(table)} order by created_at`;
    const res = await this.db.execute(q);
    return { columns: res.fields.map((f) => f.name), rows: res.rows as Record<string, unknown>[] };
  }
}

export { toAdjustment };
