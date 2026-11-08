ALTER TABLE "billing_config" ADD COLUMN "gst_registered" boolean;--> statement-breakpoint
ALTER TABLE "billing_config" ADD COLUMN "pan" text;--> statement-breakpoint
ALTER TABLE "billing_config" ADD COLUMN "sac_code" text;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN "billing_snapshot" jsonb;