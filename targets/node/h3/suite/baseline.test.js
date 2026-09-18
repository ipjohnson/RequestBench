/**
 * baseline: the dispatch floor, with no serialization in the way.
 *
 * The one endpoint in the corpus that answers a literal. Its whole contract is the string
 * and the content type, and the content type is the half a test gets wrong: a target that
 * answers "Hello, World!" as application/json has passed the body and failed the endpoint.
 * The floor checks the kind of body before the body for that reason.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as floor from "./floor.js";
import * as planned from "./planned.js";
import { send } from "./fetch.js";

// rb:test baseline.plaintext
test("the plaintext route answers a literal as text", async () => {
  const a = planned.ask("baseline.plaintext");

  const answer = await send(a);

  floor.check(a, answer);
  assert.match(answer.contentType, /^text\/plain/);
});
