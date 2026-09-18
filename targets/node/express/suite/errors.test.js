/**
 * errors: the three refusals that are nobody's fault but the request's.
 *
 * All three are envelopes rather than pinned bodies. errors.unmatched is the one that tests
 * the framework rather than the handler: nothing registers that path, so what answers is
 * whatever the target does with a route it does not have.
 */
import * as envelope from "./envelope.js";
import * as floor from "./floor.js";
import * as planned from "./planned.js";
import { send } from "./supertest.js";

const TARGET = "node:express";

describe("errors", () => {
  // rb:test errors.not_found
  it("a registered route with no such row answers 404", async () => {
    const a = planned.ask("errors.not_found");

    const answer = await send(a);

    envelope.check(a, answer, TARGET);
  });

  // rb:test errors.unmatched
  it("a path nothing registers answers the frameworks own 404", async () => {
    const a = planned.ask("errors.unmatched");

    const answer = await send(a);

    envelope.check(a, answer, TARGET);
  });

  // rb:test errors.malformed
  it("a body that is not JSON at all is refused", async () => {
    const a = planned.ask("errors.malformed");

    const answer = await send(a);

    envelope.check(a, answer, TARGET);
  });
});
