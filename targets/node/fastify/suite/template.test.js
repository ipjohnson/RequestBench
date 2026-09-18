/**
 * template: server-side HTML, at two sizes.
 *
 * The one family whose body is not compared byte for byte. Five template engines cannot
 * agree on formatting without every template being contorted to match, so the spec pins the
 * content and leaves the whitespace free: same elements, same order, same values. The floor
 * normalises both sides the way the conformance client does.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as floor from "./floor.js";
import * as planned from "./planned.js";
import { send } from "./inject.js";

// rb:test template.small
test("the small template renders the pinned content", async () => {
  const a = planned.ask("template.small");

  const answer = await send(a);

  floor.check(a, answer);
  assert.match(answer.contentType, /^text\/html/);
});

// rb:test template.medium
test("the medium template does too", async () => {
  const a = planned.ask("template.medium");

  const answer = await send(a);

  floor.check(a, answer);
});
