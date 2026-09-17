// @ts-check
import { defineConfig } from "astro/config";

import { resultsData } from "./src/integrations/results-data.js";

// `format: "file"` keeps the URLs build.py produced: index.html at the root and one
// f/<language>-<target>.html per target, rather than a directory with an index in it. Links
// between the two are written relative, so the site works under a project path on Pages and
// out of any directory it is copied to.
export default defineConfig({
  outDir: process.env.RB_OUT || "./dist",
  integrations: [resultsData()],
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
