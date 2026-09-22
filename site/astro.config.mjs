// @ts-check
import { defineConfig } from "astro/config";

import { relativeAssets } from "./src/integrations/relative-assets.ts";
import { resultsData } from "./src/integrations/results-data.ts";

// `format: "file"` writes index.html at the root and one f/<language>-<name>.html per
// framework, rather than a directory with an index in it.
//
// Every link out of a page is relative: the ones between pages because they are written that
// way, and the ones to assets because src/integrations/relative-assets.ts rewrites them. So
// the site works under a project path on Pages, at an origin root, and out of any directory it
// is copied to, with no base path configured anywhere.
export default defineConfig({
  outDir: process.env.RB_OUT || "./dist",
  integrations: [resultsData(), relativeAssets()],
  build: { format: "file", assets: "assets" },
  devToolbar: { enabled: false },
  vite: {
    build: {
      // Two entry points, a few KB each. Splitting them into shared chunks costs a round trip
      // per page for no saving.
      assetsInlineLimit: 0,
    },
  },
});
