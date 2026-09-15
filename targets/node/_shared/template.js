// The one template engine every Node target renders with, and the one template.
//
// Pinned the way the gzip level is. An engine is a large constant factor, so five targets
// on five engines would make template.small a comparison of engines with the framework
// underneath it invisible. Fastify reaches this file through @fastify/view, which is its
// own facility; the four frameworks with no view integration call render() directly.
import Handlebars from "handlebars";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const VIEWS = join(dirname(fileURLToPath(import.meta.url)), "views");

// Compiled once, rendered per request, which is what every other language does. A
// precomputed string would measure nothing.
const items = Handlebars.compile(readFileSync(join(VIEWS, "items.hbs"), "utf8"));

export const renderItems = (body) => items(body);
