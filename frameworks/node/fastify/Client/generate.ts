// Writes the client from openapi.json with Kiota's npm package, then makes the TypeScript Kiota
// writes loadable by Node's type stripping. Fastify recommends no client generator, so the client
// is Kiota's.
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ConsumerOperation, generateClient, KiotaGenerationLanguage, LogLevel } from "@microsoft/kiota";

const client = import.meta.dirname;
const output = join(client, "Kiota");

const result = await generateClient({
  openAPIFilePath: join(client, "openapi.json"),
  clientClassName: "FastifyClient",
  clientNamespaceName: "Client",
  language: KiotaGenerationLanguage.TypeScript,
  outputPath: output,
  operation: ConsumerOperation.Generate,
  workingDirectory: client,
  cleanOutput: true,
  excludeBackwardCompatible: true,
  includeAdditionalData: true,
});
// result.isSuccess looks for a log line this mode of Kiota never returns, so the errors are read instead.
const errors = (result?.logs ?? []).filter((entry) => entry.level >= LogLevel.error);
if (result === undefined || errors.length > 0) throw new Error(`kiota: ${errors.map((e) => e.message).join("; ") || "no result"}`);
rmSync(join(output, ".kiota.log"), { force: true });

// Kiota imports ./x/index.js for x/index.ts, and tsc rejects its root client because Kiota reserves
// `query`, which the corpus uses as a path segment.
for (const name of readdirSync(output, { recursive: true, encoding: "utf8" })) {
  if (!name.endsWith(".ts")) continue;
  const path = join(output, name);
  const source = readFileSync(path, "utf8").replace(/(from '\.{1,2}\/[^']*)\.js'/g, "$1.ts'");
  writeFileSync(path, `// @ts-nocheck\n${source}`);
}
