import { config } from "dotenv";

/**
 * The CLI runs through tsx with CommonJS output. Keep awaits inside main()
 * so esbuild does not reject top-level await.
 *
 * Load environment variables before importing database-dependent modules.
 */
async function main(): Promise<void> {
  config({ path: ".env.local" });
  config();

  const dryRun = process.argv.includes("--dry-run");
  const { runReminders } = await import("./run-reminders");
  process.exitCode = await runReminders({ dryRun });
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
