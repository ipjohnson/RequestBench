/**
 * json: serialization cost at three sizes, and nothing else in the path.
 *
 * The three differ only in how much there is to serialize, so there is nothing here a test
 * can say that the floor does not already say better: the pinned body is the whole contract.
 * What the three tests are for is the ratchet. An endpoint with no test is counted, and
 * three that pass at three sizes is how a serializer that truncates the large one is caught.
 */
import * as floor from "./floor.js";
import * as planned from "./planned.js";
import { send } from "./supertest.js";

describe("json", () => {
  // rb:test json.small
  it("the small payload serializes to what the spec pins", async () => {
    const a = planned.ask("json.small");

    const answer = await send(a);

    floor.check(a, answer);
  });

  // rb:test json.medium
  it("the medium payload does too", async () => {
    const a = planned.ask("json.medium");

    const answer = await send(a);

    floor.check(a, answer);
  });

  // rb:test json.large
  it("and the large one which is where a truncation would show", async () => {
    const a = planned.ask("json.large");

    const answer = await send(a);

    floor.check(a, answer);
  });
});
