ALTER TABLE "support_tickets" ADD COLUMN "last_read_by_user_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "last_read_by_admin_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "last_delivered_to_user_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "last_delivered_to_admin_at" timestamp with time zone;