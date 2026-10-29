const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const stylesheet = path.join(projectRoot, "src", "app", "globals.css");

/**
 * Turbopack sometimes runs PostCSS with `from` unset or pointed at a file in
 * the parent of this repo. Tailwind then resolves `@import "tailwindcss"` from
 * that directory, where node_modules does not exist.
 * Webpack only accepts PostCSS plugins as resolvable paths, so this stays a module.
 */
function pinStylesheet() {
  return {
    postcssPlugin: "pin-stylesheet-from",
    Once(_root, { result }) {
      const from = typeof result.opts.from === "string" ? path.resolve(result.opts.from) : "";
      const insideProject = from === projectRoot || from.startsWith(projectRoot + path.sep);
      if (!insideProject) result.opts.from = stylesheet;
    },
  };
}

pinStylesheet.postcss = true;
module.exports = pinStylesheet;
