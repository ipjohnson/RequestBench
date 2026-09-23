import { defineConfig } from "@hey-api/openapi-ts";

// The plugins litestar-vite's templates configure, with .ts imports for Node's type stripping.
export default defineConfig({
  input: "openapi.json",
  output: { path: "HeyApi", importFileExtension: ".ts" },
  plugins: ["@hey-api/typescript", "@hey-api/schemas", "@hey-api/sdk", "@hey-api/client-fetch"],
});
