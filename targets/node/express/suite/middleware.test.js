/**
 * middleware: per-layer dispatch cost at 0, 4 and 16 no-op layers.
 *
 * The layers are no-ops, so nothing they do is visible in a response and no assertion over
 * one can tell four apart from sixteen. What a test can hold is the thing that goes wrong in
 * practice: a test that calls the handler rather than the app passes while the layers never
 * ran at all. The test host boots the application, so the layers are in the path here by
 * construction, and that is the whole of what these three assert.
 */
import * as floor from "./floor.js";
import * as planned from "./planned.js";
import { send } from "./supertest.js";

describe("middleware", () => {
  // rb:test middleware.none
  it("the unlayered route answers the shared payload", async () => {
    const a = planned.ask("middleware.none");

    const answer = await send(a);

    floor.check(a, answer);
  });

  // rb:test middleware.four
  it("four layers do not change the answer", async () => {
    const a = planned.ask("middleware.four");

    const answer = await send(a);

    floor.check(a, answer);
  });

  // rb:test middleware.sixteen
  it("sixteen layers do not change it either", async () => {
    const a = planned.ask("middleware.sixteen");

    const answer = await send(a);

    floor.check(a, answer);
  });
});
