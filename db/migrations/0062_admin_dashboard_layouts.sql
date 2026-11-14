CREATE TABLE "admin_dashboard_layouts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"block_order" jsonb NOT NULL,
	"hidden" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_dashboard_layouts" ADD CONSTRAINT "admin_dashboard_layouts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;