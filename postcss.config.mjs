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

const configDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot =
  findProjectRoot(process.cwd()) ?? findProjectRoot(configDir) ?? configDir;

/**
 * `base` keeps Tailwind scanning this app.
 * The pin plugin runs first and points `from` at src/app/globals.css when
 * Turbopack supplies a path outside this repo. Webpack accepts that plugin
 * only as a resolvable path, so it is not an inline function.
 */
const config = {
  plugins: [
    path.join(projectRoot, "postcss", "pin-stylesheet.cjs"),
    ["@tailwindcss/postcss", { base: projectRoot }],
  ],
};

export default config;
