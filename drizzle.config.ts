import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load env so drizzle-kit CLI sees DATABASE_URL (.env.local takes precedence; Next uses it in app)
config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
