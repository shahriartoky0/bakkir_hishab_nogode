import { sql, type SQL } from "drizzle-orm";
import type { ClearPlan, ClearRange, DataEraser } from "@/application/ports/repositories";
import type { Database } from "../db/client";

type Executor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

const DHAKA_DATE = (col: SQL) => sql`(${col} at time zone 'Asia/Dhaka')::date`;
/** For `col in (…)`: an empty list becomes `(null)`, which matches nothing. */
const ids = (list: string[]): SQL => (list.length ? sql.join(list.map((i) => sql`${i}::uuid`), sql`, `) : sql`null::uuid`);
/** `col not in (…)` that is TRUE for an empty list (plain `not in (null)` would be NULL). */
const notIn = (col: SQL, list: string[]): SQL => (list.length ? sql`${col} not in (${ids(list)})` : sql`true`);

async function column(db: Executor, q: SQL): Promise<string[]> {
  const res = await db.execute(q);
  return (res.rows as { id: string }[]).map((r) => r.id);
}

/**
 * "Clear data for a date range" (owner action). Works out the full closure of rows to
 * delete so balances stay consistent, then deletes them with the delete guard lifted
 * for this transaction only (see drizzle/0003_admin_clear.sql).
 */
export function makeEraser(db: Executor): DataEraser {
  return {
    async plan(range: ClearRange): Promise<ClearPlan> {
      const { from, to } = range;

      // Sales by sale date.
      const saleIds = await column(db, sql`select id from sales where sale_date between ${from}::date and ${to}::date`);
      const saleInst = await column(db, sql`select id from installments where sale_id in (${ids(saleIds)})`);

      // Adjustments: in range, tied to a deleted sale, or crediting a deleted sale's installments.
      const adjInRange = await column(db, sql`select id from adjustments where ${DHAKA_DATE(sql`created_at`)} between ${from}::date and ${to}::date`);
      const adjLinked = await column(
        db,
        sql`select distinct a.id from adjustments a
            left join allocations al on al.adjustment_id = a.id
            where a.sale_id in (${ids(saleIds)}) or al.installment_id in (${ids(saleInst)})`,
      );
      const adjustmentIds = [...new Set([...adjInRange, ...adjLinked])];
      const installmentIds = [
        ...new Set([...saleInst, ...(await column(db, sql`select id from installments where adjustment_id in (${ids(adjustmentIds)})`))]),
      ];

      // Payments: in range, tied to a deleted sale, or paying a deleted installment.
      const payInRange = await column(db, sql`select id from payments where ${DHAKA_DATE(sql`paid_at`)} between ${from}::date and ${to}::date`);
      const payLinked = await column(
        db,
        sql`select distinct p.id from payments p
            left join allocations al on al.payment_id = p.id
            where p.sale_id in (${ids(saleIds)}) or al.installment_id in (${ids(installmentIds)})`,
      );
      const paymentIds = [...new Set([...payInRange, ...payLinked])];

      const followUpIds = await column(
        db,
        sql`select id from follow_ups
            where ${DHAKA_DATE(sql`created_at`)} between ${from}::date and ${to}::date or sale_id in (${ids(saleIds)})`,
      );

      // Customers added in the range that will have nothing left afterwards.
      const customerIds = range.removeEmptyCustomers
        ? await column(
            db,
            sql`select c.id from customers c
                where ${DHAKA_DATE(sql`c.created_at`)} between ${from}::date and ${to}::date
                  and not exists (select 1 from sales s where s.customer_id = c.id and ${notIn(sql`s.id`, saleIds)})
                  and not exists (select 1 from payments p where p.customer_id = c.id and ${notIn(sql`p.id`, paymentIds)})
                  and not exists (select 1 from adjustments a where a.customer_id = c.id and ${notIn(sql`a.id`, adjustmentIds)})
                  and not exists (select 1 from installments i where i.customer_id = c.id and ${notIn(sql`i.id`, installmentIds)})
                  and not exists (select 1 from follow_ups f where f.customer_id = c.id and ${notIn(sql`f.id`, followUpIds)})`,
          )
        : [];

      const photoRows = (
        await db.execute(sql`
          select p.file_key, p.thumb_key from sale_item_photos p join sale_items si on si.id = p.sale_item_id
          where si.sale_id in (${ids(saleIds)})
          union all
          select photo_key, photo_thumb_key from customers where id in (${ids(customerIds)})`)
      ).rows as { file_key: string | null; thumb_key: string | null }[];
      const photoKeys = [...new Set(photoRows.flatMap((r) => [r.file_key, r.thumb_key]).filter((k): k is string => Boolean(k)))];

      const inRange = new Set([...payInRange, ...adjInRange]);
      return {
        range,
        saleIds,
        paymentIds,
        adjustmentIds,
        installmentIds,
        followUpIds,
        customerIds,
        photoKeys,
        counts: {
          sales: saleIds.length,
          payments: paymentIds.length,
          adjustments: adjustmentIds.length,
          followUps: followUpIds.length,
          customers: customerIds.length,
          photos: photoRows.filter((r) => r.file_key).length,
          linkedPayments: paymentIds.filter((id) => !inRange.has(id)).length,
          linkedAdjustments: adjustmentIds.filter((id) => !inRange.has(id)).length,
        },
      };
    },

    async snapshot(plan) {
      const rows = async (q: SQL) => (await db.execute(q)).rows as unknown[];
      return {
        range: [plan.range],
        sales: await rows(sql`select * from sales where id in (${ids(plan.saleIds)})`),
        sale_items: await rows(sql`select * from sale_items where sale_id in (${ids(plan.saleIds)})`),
        sale_item_photos: await rows(
          sql`select p.* from sale_item_photos p join sale_items si on si.id = p.sale_item_id where si.sale_id in (${ids(plan.saleIds)})`,
        ),
        installments: await rows(sql`select * from installments where id in (${ids(plan.installmentIds)})`),
        payments: await rows(sql`select * from payments where id in (${ids(plan.paymentIds)})`),
        adjustments: await rows(sql`select * from adjustments where id in (${ids(plan.adjustmentIds)})`),
        allocations: await rows(
          sql`select * from allocations where payment_id in (${ids(plan.paymentIds)}) or adjustment_id in (${ids(plan.adjustmentIds)}) or installment_id in (${ids(plan.installmentIds)})`,
        ),
        follow_ups: await rows(sql`select * from follow_ups where id in (${ids(plan.followUpIds)})`),
        customers: await rows(sql`select * from customers where id in (${ids(plan.customerIds)})`),
      };
    },

    async erase(plan) {
      // Lift the "never delete" trigger for THIS transaction only.
      await db.execute(sql`select set_config('baki.allow_delete', 'on', true)`);

      // Remaining sales whose allocations will change need their status recomputed afterwards.
      const touched = await column(
        db,
        sql`select distinct i.sale_id as id from allocations al join installments i on i.id = al.installment_id
            where (al.payment_id in (${ids(plan.paymentIds)}) or al.adjustment_id in (${ids(plan.adjustmentIds)}))
              and i.sale_id is not null and ${notIn(sql`i.sale_id`, plan.saleIds)}`,
      );

      await db.execute(sql`delete from allocations
        where payment_id in (${ids(plan.paymentIds)}) or adjustment_id in (${ids(plan.adjustmentIds)})
           or installment_id in (${ids(plan.installmentIds)})`);
      await db.execute(sql`delete from installments where id in (${ids(plan.installmentIds)})`);
      await db.execute(sql`delete from follow_ups where id in (${ids(plan.followUpIds)})`);
      await db.execute(sql`delete from payments where id in (${ids(plan.paymentIds)})`);
      await db.execute(sql`delete from adjustments where id in (${ids(plan.adjustmentIds)})`);
      await db.execute(sql`delete from sales where id in (${ids(plan.saleIds)})`); // items + photos cascade
      await db.execute(sql`delete from customers where id in (${ids(plan.customerIds)})`);

      if (touched.length) {
        await db.execute(sql`
          update sales s set
            status = case when sb.remaining_minor > 0 then 'open' when s.status = 'written_off' then 'written_off' else 'closed' end,
            updated_at = now()
          from sale_balances sb
          where sb.sale_id = s.id and s.id in (${ids(touched)}) and s.status <> 'cancelled'`);
      }
      await db.execute(sql`select set_config('baki.allow_delete', 'off', true)`);
    },
  };
}
