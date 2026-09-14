// Read a dependency's version without going through its exports map.
//
// Several packages (hono, @hono/node-server, the Functions Framework) do not export
// ./package.json, so require("<pkg>/package.json") throws. Walking up from the resolved
// entry point to its package.json works for all of them.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

export function pkgVersion(name) {
  try {
    return JSON.parse(readFileSync(require.resolve(name + "/package.json"), "utf8")).version;
  } catch { /* not exported; fall through */ }
  try {
    let dir = dirname(require.resolve(name));
    for (let i = 0; i < 6; i++) {
      try {
        const j = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
        if (j.name === name) return j.version;
      } catch { /* keep walking */ }
      dir = dirname(dir);
    }
  } catch { /* unresolvable */ }
  return "";
}
