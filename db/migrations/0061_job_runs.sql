CREATE TABLE "job_runs" (
	"job" text PRIMARY KEY NOT NULL,
	"last_started_at" timestamp with time zone NOT NULL,
	"last_finished_at" timestamp with time zone NOT NULL,
	"last_ok" boolean NOT NULL,
	"last_error" text,
	"last_duration_ms" integer NOT NULL,
	"last_ok_at" timestamp with time zone,
	"failures_in_a_row" integer DEFAULT 0 NOT NULL
);
