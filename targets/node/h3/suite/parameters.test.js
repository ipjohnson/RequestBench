/**
 * parameters: route capture, at zero, one and two segments.
 *
 * Each capture is bound as an integer and echoed. planned.js fills the pinned body with the
 * values it sent, so the floor check holds the echo to them. The static path also matches the
 * one-capture route, so its test holds that the router prefers the literal. A target whose
 * two-segment pattern is wrong answers 404, and the floor says so on the status line before it
 * ever looks at a body.
 */
import { test } from "node:test";
import * as floor from "./floor.js";
import * as planned from "./planned.js";
import { send } from "./fetch.js";

// rb:test parameters.static
test("a route with nothing to capture matches", async () => {
  const a = planned.ask("parameters.static");

  const answer = await send(a);

  floor.check(a, answer);
});

// rb:test parameters.one
test("one captured segment is bound and echoed", async () => {
  const a = planned.ask("parameters.one");

  const answer = await send(a);

  floor.check(a, answer);
});

// rb:test parameters.two
test("two captured segments are bound and echoed", async () => {
  const a = planned.ask("parameters.two");

  const answer = await send(a);

  floor.check(a, answer);
});
