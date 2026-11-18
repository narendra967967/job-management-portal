CREATE TABLE "billing_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"mobile" text NOT NULL,
	"address_line" text NOT NULL,
	"city" text NOT NULL,
	"state_code" text NOT NULL,
	"pin" text NOT NULL,
	"country" text DEFAULT 'IN' NOT NULL,
	"gstin" text,
	"business_name" text,
	"pan" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_counters" (
	"series" text PRIMARY KEY NOT NULL,
	"last_seq" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"user_id" text,
	"number" text NOT NULL,
	"series" text NOT NULL,
	"seq" integer NOT NULL,
	"financial_year" text NOT NULL,
	"mode" "gateway_mode" NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"template_version" integer NOT NULL,
	"total_amount" integer NOT NULL,
	"doc" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_seq_ck" CHECK ("invoices"."seq" >= 1),
	CONSTRAINT "invoices_number_ck" CHECK (length("invoices"."number") <= 16 and "invoices"."number" ~ '^[A-Za-z0-9/-]+$')
);
--> statement-breakpoint
ALTER TABLE "billing_config" ADD COLUMN "business_state" text;--> statement-breakpoint
ALTER TABLE "billing_config" ADD COLUMN "invoice_terms" jsonb;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN "buyer_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN "cgst_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN "sgst_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN "igst_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN "place_of_supply" text;--> statement-breakpoint
ALTER TABLE "billing_profiles" ADD CONSTRAINT "billing_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_payment_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."payment_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_order_uq" ON "invoices" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_uq" ON "invoices" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_series_seq_uq" ON "invoices" USING btree ("series","seq");--> statement-breakpoint
CREATE INDEX "invoices_user_issued_idx" ON "invoices" USING btree ("user_id","issued_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_tax_split_ck" CHECK ("payment_orders"."cgst_amount" >= 0 and "payment_orders"."sgst_amount" >= 0 and "payment_orders"."igst_amount" >= 0 and ("payment_orders"."cgst_amount" + "payment_orders"."sgst_amount" + "payment_orders"."igst_amount" = 0 or "payment_orders"."cgst_amount" + "payment_orders"."sgst_amount" + "payment_orders"."igst_amount" = "payment_orders"."tax_amount"));