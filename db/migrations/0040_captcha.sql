ALTER TABLE "security_config" ADD COLUMN "captcha_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "security_config" ADD COLUMN "captcha_site_key" text;--> statement-breakpoint
ALTER TABLE "security_config" ADD COLUMN "captcha_secret_ciphertext" text;--> statement-breakpoint
ALTER TABLE "security_config" ADD COLUMN "captcha_secret_last4" text;