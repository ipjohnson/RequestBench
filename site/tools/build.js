// The site build: where the summaries are, where the exemplars are, where to write, and
// optionally where the published page should read its results from.
//
//   node site/tools/build.js --summaries results/summary --exemplars results/exemplars \
//                            --out site/dist [--data-base https://example.org/results/]
//
// Astro renders the pages and src/integrations/results-data.ts writes the data directory
// beside them; this is the argument parsing, which an Astro config has nowhere to put.
//
// --summaries may be left out. The result is the explorer with no data of its own, which is
// what to build when the results live in their own repo: --data-base names where to read them
// and the page fetches the catalog on load.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.resolve(fileURLToPath(import.meta.url), "../..");

// A path given on the command line means what it would mean in the shell it was typed in; a
// default means what it says relative to the repository, because `npm run build -w @rb/site`
// runs this from site/ and "results/exemplars" there is nothing.
const DEFAULTS = { summaries: null, exemplars: "results/exemplars", out: "site/dist", dataBase: null };

function parseArgs(argv) {
  const out = { ...DEFAULTS };
  const names = { "--summaries": "summaries", "--exemplars": "exemplars", "--out": "out", "--data-base": "dataBase" };
  for (let i = 0; i < argv.length; i += 1) {
    const key = names[argv[i]];
    if (!key) {
      console.error(`unknown argument ${argv[i]}`);
      process.exit(2);
    }
    const value = argv[i + 1];
    if (value === undefined) {
      console.error(`${argv[i]} needs a value`);
      process.exit(2);
    }
    out[key] = value;
    i += 1;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const ROOT = path.dirname(HERE);
// Resolved here, because Astro runs from site/ and a relative path would mean something else
// there.
const at = (key) =>
  args[key] === null ? "" : path.resolve(args[key] === DEFAULTS[key] ? ROOT : process.cwd(), args[key]);
const outDir = at("out");

// The CLI rather than the programmatic build, run from site/. Astro puts its build scratch
// under the workspace root, and from there Node resolves astro's own dependencies against the
// workspace's node_modules rather than this package's, which fails on the first import.
execFileSync("npx", ["astro", "build"], {
  cwd: HERE,
  stdio: "inherit",
  env: {
    ...process.env,
    RB_ROOT: ROOT,
    RB_SUMMARIES: at("summaries"),
    RB_EXEMPLARS: at("exemplars"),
    RB_DATA_BASE: args.dataBase ?? "",
    RB_OUT: outDir,
  },
});
