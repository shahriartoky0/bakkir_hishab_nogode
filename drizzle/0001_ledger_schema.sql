CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid,
	"summary" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adjustments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"customer_id" uuid NOT NULL,
	"sale_id" uuid,
	"type" text NOT NULL,
	"direction" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "adjustments_type_ck" CHECK ("adjustments"."type" in ('opening_balance','return','discount','write_off','correction')),
	CONSTRAINT "adjustments_direction_ck" CHECK ("adjustments"."direction" in ('debit','credit')),
	CONSTRAINT "adjustments_amount_ck" CHECK ("adjustments"."amount_minor" > 0 and length(trim("adjustments"."reason")) > 0)
);
--> statement-breakpoint
CREATE TABLE "allocations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payment_id" uuid,
	"adjustment_id" uuid,
	"installment_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "allocations_amount_ck" CHECK ("allocations"."amount_minor" > 0),
	CONSTRAINT "allocations_source_ck" CHECK (num_nonnulls("allocations"."payment_id", "allocations"."adjustment_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"parent_id" uuid,
	"name_bn" text,
	"name_en" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_ck" CHECK (coalesce("categories"."name_bn", "categories"."name_en") is not null)
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_bn" text,
	"phone" text NOT NULL,
	"alt_phone" text,
	"address" text,
	"photo_key" text,
	"photo_thumb_key" text,
	"nid_number" text,
	"guarantor_name" text,
	"guarantor_phone" text,
	"guarantor_relation" text,
	"credit_limit_minor" bigint,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_phone_unique" UNIQUE("phone"),
	CONSTRAINT "customers_phone_e164_ck" CHECK ("customers"."phone" ~ '^\+8801[3-9][0-9]{8}$')
);
--> statement-breakpoint
CREATE TABLE "field_definitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"category_id" uuid,
	"key" text NOT NULL,
	"label_bn" text,
	"label_en" text,
	"type" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"unit_bn" text,
	"unit_en" text,
	"is_required" boolean DEFAULT false NOT NULL,
	"show_on_receipt" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "field_definitions_scope_key_uq" UNIQUE NULLS NOT DISTINCT("category_id","key"),
	CONSTRAINT "field_definitions_type_ck" CHECK ("field_definitions"."type" in ('text','number','decimal','money','select','date','boolean'))
);
--> statement-breakpoint
CREATE TABLE "follow_ups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"customer_id" uuid NOT NULL,
	"sale_id" uuid,
	"channel" text NOT NULL,
	"outcome" text NOT NULL,
	"note" text,
	"promised_amount_minor" bigint,
	"promised_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follow_ups_channel_ck" CHECK ("follow_ups"."channel" in ('call','whatsapp','visit','in_shop')),
	CONSTRAINT "follow_ups_outcome_ck" CHECK ("follow_ups"."outcome" in ('reached','no_answer','promised','refused')),
	CONSTRAINT "follow_ups_promise_ck" CHECK ("follow_ups"."outcome" <> 'promised' or "follow_ups"."promised_date" is not null)
);
--> statement-breakpoint
CREATE TABLE "installments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"customer_id" uuid NOT NULL,
	"sale_id" uuid,
	"adjustment_id" uuid,
	"seq" integer NOT NULL,
	"due_date" date NOT NULL,
	"amount_minor" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "installments_amount_ck" CHECK ("installments"."amount_minor" > 0),
	CONSTRAINT "installments_source_ck" CHECK (num_nonnulls("installments"."sale_id", "installments"."adjustment_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"customer_id" uuid NOT NULL,
	"sale_id" uuid,
	"receipt_number" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"method" text NOT NULL,
	"reference" text,
	"paid_at" timestamp with time zone NOT NULL,
	"note" text,
	"status" text DEFAULT 'active' NOT NULL,
	"void_reason" text,
	"voided_at" timestamp with time zone,
	"idempotency_key" text,
	"is_upfront" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_receipt_number_unique" UNIQUE("receipt_number"),
	CONSTRAINT "payments_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "payments_amount_ck" CHECK ("payments"."amount_minor" > 0),
	CONSTRAINT "payments_method_ck" CHECK ("payments"."method" in ('cash','bkash','nagad','rocket','bank','card','other')),
	CONSTRAINT "payments_status_ck" CHECK ("payments"."status" in ('active','voided')),
	CONSTRAINT "payments_void_ck" CHECK ("payments"."status" = 'active' or ("payments"."void_reason" is not null and "payments"."voided_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "sale_item_photos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sale_item_id" uuid NOT NULL,
	"file_key" text NOT NULL,
	"thumb_key" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sale_id" uuid NOT NULL,
	"category_id" uuid,
	"name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_minor" bigint NOT NULL,
	"line_total_minor" bigint NOT NULL,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_items_qty_ck" CHECK ("sale_items"."quantity" >= 1 and "sale_items"."line_total_minor" = "sale_items"."unit_price_minor" * "sale_items"."quantity")
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY NOT NULL,
	"customer_id" uuid NOT NULL,
	"sale_number" text NOT NULL,
	"sale_date" date NOT NULL,
	"subtotal_minor" bigint NOT NULL,
	"discount_minor" bigint DEFAULT 0 NOT NULL,
	"total_minor" bigint NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"notes" text,
	"idempotency_key" text,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_sale_number_unique" UNIQUE("sale_number"),
	CONSTRAINT "sales_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "sales_status_ck" CHECK ("sales"."status" in ('open','closed','written_off','cancelled')),
	CONSTRAINT "sales_amounts_ck" CHECK ("sales"."subtotal_minor" >= 0 and "sales"."discount_minor" >= 0 and "sales"."total_minor" = "sales"."subtotal_minor" - "sales"."discount_minor")
);
--> statement-breakpoint
CREATE TABLE "sequences" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"next_value" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sequences_kind_unique" UNIQUE("kind")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"singleton" boolean DEFAULT true NOT NULL,
	"shop_name_bn" text,
	"shop_name_en" text,
	"address_bn" text,
	"address_en" text,
	"phone" text,
	"logo_key" text,
	"receipt_footer_bn" text,
	"receipt_footer_en" text,
	"default_locale" text DEFAULT 'bn' NOT NULL,
	"use_bangla_digits" boolean DEFAULT true NOT NULL,
	"default_credit_days" integer DEFAULT 30 NOT NULL,
	"sale_prefix" text DEFAULT 'INV-' NOT NULL,
	"receipt_prefix" text DEFAULT 'RCP-' NOT NULL,
	"auto_logout_minutes" integer DEFAULT 30 NOT NULL,
	"starter_set_decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_singleton_unique" UNIQUE("singleton"),
	CONSTRAINT "settings_singleton_ck" CHECK ("settings"."singleton")
);
--> statement-breakpoint
CREATE TABLE "translation_overrides" (
	"id" uuid PRIMARY KEY NOT NULL,
	"locale" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "translation_overrides_locale_key_uq" UNIQUE("locale","key")
);
--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_adjustment_id_adjustments_id_fk" FOREIGN KEY ("adjustment_id") REFERENCES "public"."adjustments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_installment_id_installments_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."installments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_definitions" ADD CONSTRAINT "field_definitions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_adjustment_id_adjustments_id_fk" FOREIGN KEY ("adjustment_id") REFERENCES "public"."adjustments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_item_photos" ADD CONSTRAINT "sale_item_photos_sale_item_id_sale_items_id_fk" FOREIGN KEY ("sale_item_id") REFERENCES "public"."sale_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_log_at_idx" ON "activity_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "activity_log_entity_idx" ON "activity_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "adjustments_customer_idx" ON "adjustments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "allocations_installment_idx" ON "allocations" USING btree ("installment_id");--> statement-breakpoint
CREATE INDEX "allocations_payment_idx" ON "allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "allocations_adjustment_idx" ON "allocations" USING btree ("adjustment_id");--> statement-breakpoint
CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "follow_ups_customer_idx" ON "follow_ups" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "follow_ups_promised_idx" ON "follow_ups" USING btree ("promised_date");--> statement-breakpoint
CREATE INDEX "installments_customer_due_idx" ON "installments" USING btree ("customer_id","due_date");--> statement-breakpoint
CREATE INDEX "installments_sale_idx" ON "installments" USING btree ("sale_id");--> statement-breakpoint
CREATE UNIQUE INDEX "installments_sale_seq_uq" ON "installments" USING btree ("sale_id","seq") WHERE "installments"."sale_id" is not null;--> statement-breakpoint
CREATE INDEX "payments_customer_idx" ON "payments" USING btree ("customer_id","paid_at");--> statement-breakpoint
CREATE INDEX "payments_paid_at_idx" ON "payments" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "sale_item_photos_item_idx" ON "sale_item_photos" USING btree ("sale_item_id");--> statement-breakpoint
CREATE INDEX "sale_items_sale_idx" ON "sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sale_items_category_idx" ON "sale_items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "sales_customer_idx" ON "sales" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "sales_date_idx" ON "sales" USING btree ("sale_date");