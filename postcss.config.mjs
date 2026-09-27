import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

function findProjectRoot(start) {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        if (pkg.name === "weaver-bill-planner") return dir;
      } catch {
        /* keep walking */
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const projectRoot =
  findProjectRoot(process.cwd()) ??
  findProjectRoot(path.dirname(fileURLToPath(import.meta.url)));

/**
 * `base` keeps Tailwind scanning this app. Without it, a parent lockfile makes
 * Next treat the folder above this repo as the project root, `@import "tailwindcss"`
 * fails to resolve, and the page ships with no utilities.
 * Webpack only accepts PostCSS plugins as package names, so this stays a string tuple.
 */
const config = {
  plugins: [["@tailwindcss/postcss", { base: projectRoot }]],
};

export default config;
