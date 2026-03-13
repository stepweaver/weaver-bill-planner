import { config } from "dotenv";
config({ path: ".env.local" });
import { db, ledgers } from "./index";

async function seed() {
  await db.insert(ledgers).values({
    name: "Household",
    slug: "household",
    isDefault: true,
  });
  console.log("Seeded default ledger: Household");
}

seed().catch(console.error).finally(process.exit);
