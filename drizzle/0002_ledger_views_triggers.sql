-- Hand-written: search indexes, seed rows, money-safety triggers and balance views.
-- Statements are separated by drizzle's breakpoint marker.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS customers_name_trgm_idx ON customers USING gin (name gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS customers_name_bn_trgm_idx ON customers USING gin (name_bn gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS customers_phone_trgm_idx ON customers USING gin (phone gin_trgm_ops);
--> statement-breakpoint

-- Single settings row and the two gap-free counters.
INSERT INTO settings (id, singleton) VALUES (gen_random_uuid(), true) ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO sequences (id, kind, next_value) VALUES (gen_random_uuid(), 'sale', 1), (gen_random_uuid(), 'receipt', 1)
ON CONFLICT (kind) DO NOTHING;
--> statement-breakpoint

-- ===== Allocation guard: never over-allocate an installment, payment or credit =====
CREATE OR REPLACE FUNCTION allocations_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  inst_amount bigint;
  src_amount bigint;
  src_status text;
  src_direction text;
  used bigint;
BEGIN
  -- Lock the installment row so concurrent allocations serialize.
  SELECT amount_minor INTO inst_amount FROM installments WHERE id = NEW.installment_id FOR UPDATE;
  SELECT coalesce(sum(amount_minor), 0) INTO used FROM allocations
    WHERE installment_id = NEW.installment_id AND id IS DISTINCT FROM NEW.id;
  IF used + NEW.amount_minor > inst_amount THEN
    RAISE EXCEPTION 'over-allocation of installment % (% + % > %)', NEW.installment_id, used, NEW.amount_minor, inst_amount
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.payment_id IS NOT NULL THEN
    SELECT amount_minor, status INTO src_amount, src_status FROM payments WHERE id = NEW.payment_id FOR UPDATE;
    IF src_status <> 'active' THEN
      RAISE EXCEPTION 'cannot allocate a voided payment %', NEW.payment_id USING ERRCODE = 'check_violation';
    END IF;
    SELECT coalesce(sum(amount_minor), 0) INTO used FROM allocations
      WHERE payment_id = NEW.payment_id AND id IS DISTINCT FROM NEW.id;
  ELSE
    SELECT amount_minor, direction INTO src_amount, src_direction FROM adjustments WHERE id = NEW.adjustment_id FOR UPDATE;
    IF src_direction <> 'credit' THEN
      RAISE EXCEPTION 'only credit adjustments can be allocated' USING ERRCODE = 'check_violation';
    END IF;
    SELECT coalesce(sum(amount_minor), 0) INTO used FROM allocations
      WHERE adjustment_id = NEW.adjustment_id AND id IS DISTINCT FROM NEW.id;
  END IF;
  IF used + NEW.amount_minor > src_amount THEN
    RAISE EXCEPTION 'allocations exceed source amount' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER allocations_guard_trg BEFORE INSERT OR UPDATE ON allocations
  FOR EACH ROW EXECUTE FUNCTION allocations_guard();
--> statement-breakpoint

-- An installment can't shrink below what is already allocated to it.
CREATE OR REPLACE FUNCTION installments_amount_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE used bigint;
BEGIN
  SELECT coalesce(sum(amount_minor), 0) INTO used FROM allocations WHERE installment_id = NEW.id;
  IF NEW.amount_minor < used THEN
    RAISE EXCEPTION 'installment % below allocated amount', NEW.id USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER installments_amount_guard_trg BEFORE UPDATE OF amount_minor ON installments
  FOR EACH ROW EXECUTE FUNCTION installments_amount_guard();
--> statement-breakpoint

-- ===== Voiding a payment removes its allocations; a void can't be undone =====
CREATE OR REPLACE FUNCTION payments_status_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'voided' AND NEW.status <> 'voided' THEN
    RAISE EXCEPTION 'a voided payment cannot be reactivated' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.amount_minor <> OLD.amount_minor OR NEW.customer_id <> OLD.customer_id THEN
    RAISE EXCEPTION 'payment amount/customer are immutable' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER payments_status_guard_trg BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION payments_status_guard();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION payments_void_cleanup() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM allocations WHERE payment_id = NEW.id;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER payments_void_cleanup_trg AFTER UPDATE OF status ON payments
  FOR EACH ROW WHEN (OLD.status = 'active' AND NEW.status = 'voided')
  EXECUTE FUNCTION payments_void_cleanup();
--> statement-breakpoint

-- ===== Business records are archived/voided, never hard-deleted =====
CREATE OR REPLACE FUNCTION forbid_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% rows are never deleted (archive or void instead)', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER customers_no_delete BEFORE DELETE ON customers FOR EACH ROW EXECUTE FUNCTION forbid_delete();
--> statement-breakpoint
CREATE TRIGGER sales_no_delete BEFORE DELETE ON sales FOR EACH ROW EXECUTE FUNCTION forbid_delete();
--> statement-breakpoint
CREATE TRIGGER payments_no_delete BEFORE DELETE ON payments FOR EACH ROW EXECUTE FUNCTION forbid_delete();
--> statement-breakpoint
CREATE TRIGGER adjustments_no_delete BEFORE DELETE ON adjustments FOR EACH ROW EXECUTE FUNCTION forbid_delete();
--> statement-breakpoint

-- activity_log is append-only.
CREATE OR REPLACE FUNCTION activity_log_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'activity_log is append-only' USING ERRCODE = 'restrict_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER activity_log_append_only_trg BEFORE UPDATE OR DELETE ON activity_log
  FOR EACH ROW EXECUTE FUNCTION activity_log_append_only();
--> statement-breakpoint

-- ===== Balance views ("today" is the Asia/Dhaka calendar day) =====
CREATE OR REPLACE VIEW installment_balances AS
SELECT
  i.id,
  i.customer_id,
  i.sale_id,
  i.adjustment_id,
  i.seq,
  i.due_date,
  i.amount_minor,
  coalesce(a.paid, 0)::bigint AS paid_minor,
  (i.amount_minor - coalesce(a.paid, 0))::bigint AS remaining_minor,
  CASE
    WHEN i.amount_minor - coalesce(a.paid, 0) > 0 AND i.due_date < (now() AT TIME ZONE 'Asia/Dhaka')::date
      THEN ((now() AT TIME ZONE 'Asia/Dhaka')::date - i.due_date)
    ELSE 0
  END::int AS days_overdue,
  CASE
    WHEN i.amount_minor - coalesce(a.paid, 0) <= 0 THEN 'paid'
    WHEN i.due_date < (now() AT TIME ZONE 'Asia/Dhaka')::date THEN 'overdue'
    WHEN i.due_date = (now() AT TIME ZONE 'Asia/Dhaka')::date THEN 'due_today'
    ELSE 'upcoming'
  END AS status
FROM installments i
LEFT JOIN (SELECT installment_id, sum(amount_minor) AS paid FROM allocations GROUP BY installment_id) a
  ON a.installment_id = i.id
LEFT JOIN sales s ON s.id = i.sale_id
WHERE s.id IS NULL OR s.status <> 'cancelled';
--> statement-breakpoint
CREATE OR REPLACE VIEW sale_balances AS
SELECT
  s.id AS sale_id,
  s.customer_id,
  s.total_minor,
  coalesce(sum(ib.paid_minor), 0)::bigint AS paid_minor,
  coalesce(sum(ib.remaining_minor), 0)::bigint AS remaining_minor,
  coalesce(sum(ib.remaining_minor) FILTER (WHERE ib.status = 'overdue'), 0)::bigint AS overdue_minor,
  coalesce(max(ib.days_overdue), 0)::int AS max_days_overdue,
  min(ib.due_date) FILTER (WHERE ib.remaining_minor > 0) AS next_due_date
FROM sales s
LEFT JOIN installment_balances ib ON ib.sale_id = s.id
WHERE s.status <> 'cancelled'
GROUP BY s.id;
--> statement-breakpoint
CREATE OR REPLACE VIEW customer_balances AS
SELECT
  c.id AS customer_id,
  coalesce(b.balance, 0)::bigint AS balance_minor,
  coalesce(b.overdue, 0)::bigint AS overdue_minor,
  coalesce(b.max_days, 0)::int AS max_days_overdue,
  b.next_due AS next_due_date,
  p.last_paid AS last_payment_at
FROM customers c
LEFT JOIN (
  SELECT
    customer_id,
    sum(remaining_minor) AS balance,
    sum(remaining_minor) FILTER (WHERE status = 'overdue') AS overdue,
    max(days_overdue) AS max_days,
    min(due_date) FILTER (WHERE remaining_minor > 0) AS next_due
  FROM installment_balances
  GROUP BY customer_id
) b ON b.customer_id = c.id
LEFT JOIN (
  SELECT customer_id, max(paid_at) AS last_paid FROM payments WHERE status = 'active' GROUP BY customer_id
) p ON p.customer_id = c.id;
