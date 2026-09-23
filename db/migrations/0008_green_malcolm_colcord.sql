CREATE TABLE "smtp_config" (
	"id" text PRIMARY KEY DEFAULT 'app' NOT NULL,
	"host" text NOT NULL,
	"port" integer DEFAULT 587 NOT NULL,
	"secure" boolean DEFAULT false NOT NULL,
	"username" text,
	"password_ciphertext" text,
	"from_email" text NOT NULL,
	"from_name" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
