import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

const connectionString = process.env.DATABASE_URL ?? "postgresql://build:build@localhost:5432/build";
const sql = neon(connectionString);
export const db = drizzle(sql);

export * from "./schema";
