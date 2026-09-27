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

const stylesheet = path.join(projectRoot, "src", "app", "globals.css");

/**
 * Turbopack sometimes runs PostCSS with `from` unset or pointed at a
 * generated file. Tailwind then resolves `@import "tailwindcss"` from the
 * parent of this repo (no node_modules) or scans a directory with no
 * components, so utilities are missing and the page renders unstyled.
 */
const pinStylesheetFrom = () => ({
  postcssPlugin: "pin-stylesheet-from",
  Once(_root, { result }) {
    result.opts.from = stylesheet;
  },
});
pinStylesheetFrom.postcss = true;

const config = {
  plugins: [pinStylesheetFrom(), ["@tailwindcss/postcss", { base: projectRoot }]],
};

export default config;
