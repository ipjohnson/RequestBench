// The site build: where the summaries are, where the exemplars are, where to write, and
// optionally where the published page should read its results from.
//
//   npm run site -- --summaries results/summary --exemplars results/exemplars \
//                   --out site/dist [--data-base https://example.org/results/] [--unrecorded]
//
// Astro renders the pages and src/integrations/results-data.ts writes the data directory
// beside them; this is the argument parsing, which an Astro config has nowhere to put.
//
// --summaries may be left out. The result is the explorer with no data of its own, which is
// what to build when the results live in their own repo: --data-base names where to read them
// and the page fetches the catalog on load.
//
// --unrecorded shows runs that are not recorded, which is every run made on a laptop. Without
// it the site shows recorded runs only, as the published one does.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const HERE = path.resolve(fileURLToPath(import.meta.url), "../..");
const ROOT = path.dirname(HERE);

const OPTIONS = {
  summaries: { type: "string" },
  exemplars: { type: "string" },
  out: { type: "string" },
  "data-base": { type: "string" },
  unrecorded: { type: "boolean" },
} as const;

function args() {
  try {
    return parseArgs({ options: OPTIONS }).values;
  } catch (error) {
    console.error((error as Error).message);
    process.exit(2);
  }
}

const values = args();

// A path given on the command line means what it would mean in the shell it was typed in; a
// default means what it says relative to the repository, because `npm run build -w @rb/site`
// runs this from site/ and "results/exemplars" there is nothing. Resolved here, because Astro
// runs from site/ and a relative path would mean something else there.
const given = (p: string | undefined, fallback: string): string =>
  p === undefined ? path.resolve(ROOT, fallback) : path.resolve(process.cwd(), p);

// The CLI rather than the programmatic build, run from site/. Astro puts its build scratch
// under the workspace root, and from there Node resolves astro's own dependencies against the
// workspace's node_modules rather than this package's, which fails on the first import.
execFileSync("npx", ["astro", "build"], {
  cwd: HERE,
  stdio: "inherit",
  env: {
    ...process.env,
    RB_ROOT: ROOT,
    RB_SUMMARIES: values.summaries === undefined ? "" : path.resolve(process.cwd(), values.summaries),
    RB_EXEMPLARS: given(values.exemplars, "results/exemplars"),
    RB_DATA_BASE: values["data-base"] ?? "",
    RB_OUT: given(values.out, "site/dist"),
    RB_UNRECORDED: values.unrecorded ? "1" : "",
  },
});
