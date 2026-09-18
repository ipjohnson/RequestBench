/**
 * body: binding and validating a request body, at two sizes and two refusals.
 *
 * Where the five Node targets stop agreeing. Each reaches a different validation facility, and
 * the two refusals are judged as envelopes because what a framework answers when a body is wrong
 * is its own contract, not this repository's.
 */
import * as envelope from "./envelope.js";
import * as floor from "./floor.js";
import * as planned from "./planned.js";
import { send } from "./supertest.js";

const TARGET = "node:express";

describe("body", () => {
  // rb:test body.bind_small
  it("a small body binds", async () => {
    const a = planned.ask("body.bind_small");

    const answer = await send(a);

    floor.check(a, answer);
  });

  // rb:test body.bind_medium
  it("a medium body binds", async () => {
    const a = planned.ask("body.bind_medium");

    const answer = await send(a);

    floor.check(a, answer);
  });

  // rb:test body.validate_small
  it("a small body that is valid passes validation", async () => {
    const a = planned.ask("body.validate_small");

    const answer = await send(a);

    floor.check(a, answer);
  });

  // rb:test body.validate_medium
  it("a medium body that is valid does too", async () => {
    const a = planned.ask("body.validate_medium");

    const answer = await send(a);

    floor.check(a, answer);
  });

  // rb:test body.rejected_all
  it("a body failing three rules is refused", async () => {
    const a = planned.ask("body.rejected_all");

    const answer = await send(a);

    envelope.check(a, answer, TARGET);
  });

  // rb:test body.rejected_first
  it("a body failing one rule is refused the same way", async () => {
    const a = planned.ask("body.rejected_first");

    const answer = await send(a);

    envelope.check(a, answer, TARGET);
  });
});
