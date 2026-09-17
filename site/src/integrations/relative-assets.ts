// Asset links relative to the page rather than to the server root.
//
// Astro writes `/assets/x.js`, which resolves against the origin. Pages serves this site at
// /RequestBench/, so every one of those is a 404 there and the page arrives with no stylesheet
// and no script. It only works when the site is the whole origin, which is the one layout a
// local preview has and the deployment does not.
//
// Rewriting them per page costs nothing and removes the assumption entirely: the output then
// works under a project path, at an origin root, in a directory someone copied somewhere, and
// from a preview server, without the build being told which.
//
// Astro has `base` for this, but `base` is one path chosen at build time and wrong everywhere
// else, and it would put the deployment's URL in this repository's config.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";

/** Every .html under a directory. */
function pages(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...pages(p));
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}

export function relativeAssets(): AstroIntegration {
  let assets = "assets";
  return {
    name: "rb:relative-assets",
    hooks: {
      // The directory name is configurable, so read it rather than repeating it here.
      "astro:config:done": ({ config }) => {
        assets = config.build.assets;
      },
      "astro:build:done": ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        // `src` and `href` only, and only where the value starts with the assets directory.
        // A route in the page text is also a string beginning with a slash, and /json/small is
        // not a link to anything here.
        const absolute = new RegExp(`(\\s(?:src|href)=")/${assets}/`, "g");
        let rewritten = 0;
        for (const file of pages(out)) {
          const html = fs.readFileSync(file, "utf8");
          // "" for a page at the root, "../" one level down, and so on.
          const up = path.relative(path.dirname(file), out).split(path.sep).filter(Boolean);
          const prefix = up.length ? `${up.map(() => "..").join("/")}/` : "";
          const next = html.replace(absolute, `$1${prefix}${assets}/`);
          if (next === html) continue;
          fs.writeFileSync(file, next);
          rewritten += 1;
        }

        // Fail the build rather than publish a page that only works at an origin root. This is
        // the check that was missing: the first build of this site was verified from one, and
        // every asset link on the deployed page was a 404.
        //
        // Deliberately wider than the rewrite, which only knows src and href. If Astro starts
        // reaching an asset through srcset or a data attribute, this is what says so, rather
        // than the deployment. Nothing else in a page is an attribute whose value begins with
        // this directory: a route in the text is preceded by a colon or a space, not by `="`.
        const stranded = pages(out).filter((f) =>
          new RegExp(`="/${assets}/`).test(fs.readFileSync(f, "utf8")),
        );
        if (stranded.length) {
          throw new Error(
            `${stranded.length} page(s) still link an asset from the server root, which only ` +
              `resolves when the site is the whole origin: ${stranded
                .map((f) => path.relative(out, f))
                .join(", ")}`,
          );
        }
        logger.info(`asset links made relative in ${rewritten} page(s)`);
      },
    },
  };
}
