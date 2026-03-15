CREATE TABLE "bill_instances" (
	"id" serial PRIMARY KEY NOT NULL,
	"month_id" integer NOT NULL,
	"template_id" integer,
	"name" text NOT NULL,
	"due_date" date,
	"planned_amount" real,
	"invoice_amount" real,
	"amount_paid" real,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"payment_url" text,
	"assigned_income_event_id" integer,
	"assigned_group_key" text,
	"manual_assignment" boolean DEFAULT false,
	"is_recurring" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bill_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"ledger_id" integer NOT NULL,
	"name" text NOT NULL,
	"default_due_day" integer,
	"default_planned_amount" real,
	"default_payment_url" text,
	"active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "income_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"month_id" integer NOT NULL,
	"name" text NOT NULL,
	"expected_date" date NOT NULL,
	"expected_amount" real,
	"actual_amount" real,
	"status" text DEFAULT 'expected' NOT NULL,
	"notes" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ledgers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "ledgers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "months" (
	"id" serial PRIMARY KEY NOT NULL,
	"ledger_id" integer NOT NULL,
	"month_key" text NOT NULL,
	"label" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "bill_instances" ADD CONSTRAINT "bill_instances_month_id_months_id_fk" FOREIGN KEY ("month_id") REFERENCES "public"."months"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_instances" ADD CONSTRAINT "bill_instances_template_id_bill_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."bill_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_instances" ADD CONSTRAINT "bill_instances_assigned_income_event_id_income_events_id_fk" FOREIGN KEY ("assigned_income_event_id") REFERENCES "public"."income_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_templates" ADD CONSTRAINT "bill_templates_ledger_id_ledgers_id_fk" FOREIGN KEY ("ledger_id") REFERENCES "public"."ledgers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_events" ADD CONSTRAINT "income_events_month_id_months_id_fk" FOREIGN KEY ("month_id") REFERENCES "public"."months"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "months" ADD CONSTRAINT "months_ledger_id_ledgers_id_fk" FOREIGN KEY ("ledger_id") REFERENCES "public"."ledgers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "months_ledger_month_key" ON "months" USING btree ("ledger_id","month_key");