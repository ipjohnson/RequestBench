// The lint the root's `npm run lint` has always named.
//
// Scoped to site/ for now. The .ts is linted with type information, because most of what is
// worth catching in browser code is a type question: a summary field that may be absent read
// as though it is not, a fetch nobody waits for. The .astro files get the syntax rules only;
// their frontmatter is compiled to a virtual module that a type-aware rule cannot resolve, and
// `astro check` type-checks them properly as part of the same `npm run typecheck`.
//
// client/, packages/ and gen/ are not covered yet. Turning it on there reports 115 findings in
// code this did not touch, most of them a tsconfig that does not include its own test
// directory, and fixing those is worth doing on its own rather than inside a site port.
import js from "@eslint/js";
import astro from "eslint-plugin-astro";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/.astro/**"] },
  {
    files: ["site/**/*.ts"],
    // The Astro processor hands each .astro frontmatter to the linter as a virtual
    // <file>.astro/1_1.ts, which this glob would otherwise claim.
    ignores: ["**/*.astro/**"],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { project: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // A fetch nobody waits for is how a stale table gets painted over a fresh one.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      // A summary carries fields the site does not declare, and reading one is a cast.
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
    },
  },
  ...astro.configs["flat/recommended"],
  {
    files: ["site/**/*.mjs", "site/**/*.js"],
    extends: [js.configs.recommended],
    languageOptions: { globals: { console: "readonly", process: "readonly" } },
  },
);
