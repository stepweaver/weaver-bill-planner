import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { ledgers } from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set (check .env.local or .env)");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const db = drizzle(pool);

async function seed() {
  await db.insert(ledgers).values({
    name: "Household",
    slug: "household",
    isDefault: true,
  });
  console.log("Seeded default ledger: Household");
}

seed().catch(console.error).finally(() => pool.end().then(() => process.exit(0)));
