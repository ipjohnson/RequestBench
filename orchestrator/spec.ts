// Writes the OpenAPI document every framework implements. It is committed, because a
// framework builds from a clean checkout with only its own toolchain.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { corpus, DOCUMENT, openapi, render } from "./openapi.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

writeFileSync(join(ROOT, DOCUMENT), render(openapi(await corpus(ROOT))));
console.log(`wrote ${DOCUMENT}`);
