import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '../../.env') });

const sql = postgres(process.env.DATABASE_URL as string, { max: 1 });
const db = drizzle(sql);

async function main() {
  console.log("Running manual SQL schema updates...");
  
  // 1. system_settings
  await sql`TRUNCATE TABLE "system_settings"`;
  await sql`ALTER TABLE "system_settings" DROP CONSTRAINT IF EXISTS "system_settings_pkey"`;
  await sql`ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "employee_id" integer`;
  await sql`ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_key_employee_id_pk" PRIMARY KEY("key","employee_id")`;
  await sql`ALTER TABLE "system_settings" DROP CONSTRAINT IF EXISTS "system_settings_employee_id_employees_id_fk"`;
  await sql`ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action`;

  // 2. whatsapp_contacts
  await sql`
    CREATE TABLE IF NOT EXISTS "whatsapp_contacts" (
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
    )
  `;
  await sql`ALTER TABLE "whatsapp_contacts" DROP CONSTRAINT IF EXISTS "whatsapp_contacts_employee_id_employees_id_fk"`;
  await sql`ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action`;

  console.log("Updates applied successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed!", err);
  process.exit(1);
});
