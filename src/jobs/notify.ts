import { config } from "dotenv";

config({ path: ".env.local" });
config();

const dryRun = process.argv.includes("--dry-run");
const { runReminders } = await import("./run-reminders");
const code = await runReminders({ dryRun });
process.exit(code);
