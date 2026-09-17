// Asset links have to resolve where the site is actually served.
//
// Pages serves it at /RequestBench/, so a link to /assets/x.js asks the origin root for a file
// that is not there. The first build of this site shipped exactly that, and it was verified
// from a local server root, which is the one layout where it works.
import { describe, expect, test } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { relativeAssets } from "../src/integrations/relative-assets.js";

/** The two hooks the integration uses, called the way Astro calls them. */
async function run(
  files: Record<string, string>,
  assets = "assets",
): Promise<Record<string, string>> {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "rb-assets-"));
  for (const [name, body] of Object.entries(files)) {
    fs.mkdirSync(path.join(out, path.dirname(name)), { recursive: true });
    fs.writeFileSync(path.join(out, name), body);
  }
  const hooks = relativeAssets().hooks;
  await hooks["astro:config:done"]?.({ config: { build: { assets } } } as never);
  await hooks["astro:build:done"]?.({
    dir: new URL(`file://${out}/`),
    logger: { info: () => undefined },
  } as never);
  return Object.fromEntries(
    Object.keys(files).map((name) => [name, fs.readFileSync(path.join(out, name), "utf8")]),
  );
}

describe("relativeAssets", () => {
  test("a page at the root drops the leading slash", async () => {
    const out = await run({ "index.html": `<link href="/assets/site.css"><script src="/assets/app.js">` });
    expect(out["index.html"]).toBe(`<link href="assets/site.css"><script src="assets/app.js">`);
  });

  test("a page one level down climbs out first", async () => {
    const out = await run({ "f/go-chi.html": `<link href="/assets/site.css">` });
    expect(out["f/go-chi.html"]).toBe(`<link href="../assets/site.css">`);
  });

  test("a route in the page text is not a link and is left alone", async () => {
    const body = `<pre>GET /json/small</pre><a href="../index.html">x</a>`;
    expect((await run({ "index.html": body }))["index.html"]).toBe(body);
  });

  test("it reads the configured assets directory rather than assuming one", async () => {
    const out = await run({ "index.html": `<script src="/_bundles/app.js">` }, "_bundles");
    expect(out["index.html"]).toBe(`<script src="_bundles/app.js">`);
  });

  test("a newline between the tag and the attribute is still a link", async () => {
    expect((await run({ "index.html": `<link\nhref="/assets/a.css">` }))["index.html"]).toBe(
      `<link\nhref="assets/a.css">`,
    );
  });

  test("an asset reached some other way fails the build rather than shipping a 404", async () => {
    // The rewrite knows src and href. The guard is wider on purpose, so a form it does not
    // handle stops the build here instead of 404ing on the deployment.
    const stranded = run({ "index.html": `<img srcset="/assets/a.png 2x">` });
    await expect(stranded).rejects.toThrow(/server root.*index\.html/s);
  });
});
