TRUNCATE TABLE "system_settings";--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer,
	"name" text NOT NULL,
	"type" text DEFAULT 'general' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer,
	"category_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'KWD' NOT NULL,
	"date" timestamp NOT NULL,
	"description" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_message_archive" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"instance_name" text NOT NULL,
	"archive_path" text NOT NULL,
	"total_messages" integer DEFAULT 0,
	"total_chats" integer DEFAULT 0,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"sync_started_at" timestamp,
	"sync_completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_routing_agents" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"agent_phone" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_assigned_at" timestamp DEFAULT now() NOT NULL,
	"total_assigned" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_routing_customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_phone" text NOT NULL,
	"assigned_agent_id" integer NOT NULL,
	"first_message_date" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_routing_customers_customer_phone_unique" UNIQUE("customer_phone")
);
--> statement-breakpoint
CREATE TABLE "payrolls" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer,
	"employee_id" integer NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"base_salary" integer DEFAULT 0 NOT NULL,
	"commission_percentage" integer DEFAULT 0 NOT NULL,
	"commission_earned" integer DEFAULT 0 NOT NULL,
	"deductions" integer DEFAULT 0 NOT NULL,
	"net_salary" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"currency" text DEFAULT 'KWD' NOT NULL,
	"payment_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"phone" text NOT NULL,
	"name" text,
	"profile_picture_url" text,
	"push_name" text,
	"last_seen" timestamp,
	"is_business" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "currency" SET DEFAULT 'KWD';--> statement-breakpoint
/* 
    Unfortunately in current drizzle-kit version we can't automatically get name for primary key.
    We are working on making it available!

    Meanwhile you can:
        1. Check pk name in your database, by running
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_schema = 'public'
                AND table_name = 'system_settings'
                AND constraint_type = 'PRIMARY KEY';
        2. Uncomment code below and paste pk name manually
        
    Hope to release this update as soon as possible
*/

-- Uncommented the drop constraint
ALTER TABLE "system_settings" DROP CONSTRAINT IF EXISTS "system_settings_pkey";--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_key_employee_id_pk" PRIMARY KEY("key","employee_id");--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "base_salary" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "commission_percentage" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "employee_id" integer;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD COLUMN "media_url" text;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD COLUMN "media_base64" text;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD COLUMN "mime_type" text;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD COLUMN "file_name" text;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD COLUMN "caption" text;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD COLUMN "quoted_message_id" text;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD COLUMN "status" text DEFAULT 'sent';--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD COLUMN "is_forwarded" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD COLUMN "contact_info" text;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD COLUMN "location_data" text;--> statement-breakpoint
ALTER TABLE "whatsapp_campaigns" ADD COLUMN "scheduled_at" timestamp;--> statement-breakpoint
ALTER TABLE "whatsapp_campaigns" ADD COLUMN "started_at" timestamp;--> statement-breakpoint
ALTER TABLE "whatsapp_campaigns" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "whatsapp_campaigns" ADD COLUMN "error_log" text;--> statement-breakpoint
ALTER TABLE "whatsapp_campaign_recipients" ADD COLUMN "delivered_at" timestamp;--> statement-breakpoint
ALTER TABLE "whatsapp_campaign_recipients" ADD COLUMN "read_at" timestamp;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_employees_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_message_archive" ADD CONSTRAINT "whatsapp_message_archive_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_routing_agents" ADD CONSTRAINT "whatsapp_routing_agents_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_routing_customers" ADD CONSTRAINT "whatsapp_routing_customers_assigned_agent_id_whatsapp_routing_agents_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."whatsapp_routing_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;