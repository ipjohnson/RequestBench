import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "openapi.json",
  output: { path: "HeyApi", importFileExtension: ".ts" },
});
