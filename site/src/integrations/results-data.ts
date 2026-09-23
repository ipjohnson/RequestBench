// Writing the data directory, and saying what the build read.
//
// An integration rather than a step in tools/build.ts, because the loaders are TypeScript that
// Astro compiles, and this is the point in the build where the output directory is known.
//
// Stored gzipped. Pages caps a site at 1 GB and this directory grows by a run a night, so the
// saving is in bytes at rest rather than on the wire, which Pages already compresses. The
// browser unwraps with DecompressionStream.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import type { AstroIntegration } from "astro";
import { splitHist } from "../lib/hist.ts";
import { site } from "../lib/site.ts";

export function resultsData(): AstroIntegration {
  return {
    name: "rb:results-data",
    hooks: {
      "astro:build:done": ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        const s = site();
        for (const line of s.notes) logger.info(line);

        // Clear the data directory: a rename or a dropped run would otherwise leave a stale
        // file behind that the catalog no longer references but Pages keeps serving.
        const dataDir = path.join(out, "data");
        fs.rmSync(dataDir, { recursive: true, force: true });

        const put = (rel: string, obj: unknown): void => {
          const file = path.join(dataDir, rel);
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, gzipSync(Buffer.from(JSON.stringify(obj)), { level: 9 }));
        };

        if (s.runs.length || Object.keys(s.wire).length) {
          fs.mkdirSync(dataDir, { recursive: true });
          fs.writeFileSync(path.join(dataDir, "catalog.json"), JSON.stringify(s.catalog));
          for (const entry of s.catalog.runs) {
            const raw = s.raw.get(entry.id);
            if (!raw) continue;
            const { run, hist } = splitHist(raw);
            put(entry.file, run);
            if (entry.hist) put(entry.hist, hist);
          }
          for (const [key, meta] of Object.entries(s.catalog.wire)) put(meta.file, s.wire[key]);
          for (const [key, meta] of Object.entries(s.catalog.code)) put(meta.file, s.code[key]);
        }

        const index = path.join(out, "index.html");
        logger.info(`showing ${s.runs.length} run(s)${s.config.unrecorded ? ", unrecorded ones included" : ""}`);
        logger.info(
          `wrote ${index} (${(fs.statSync(index).size / 1024).toFixed(1)} KB): ` +
            `${s.embedded.length} run(s) embedded, ${s.runs.length - s.embedded.length} fetched on ` +
            `demand, ${Object.keys(s.wire).length} wire captures` +
            (s.config.dataBase ? `; results read from ${s.config.dataBase}` : ""),
        );
      },
    },
  };
}
