import { performanceTest } from "#kit";
import { TOKEN } from "#models/configuration";

const path = "/authorized/small";

/** The token with its last character changed, so a refusal compares the whole string. */
const wrong = `${TOKEN.slice(0, -1)}0`;

export default performanceTest({
  id: { family: "authorized", name: "denied" },
  path,
  base: "authorized.allowed",
  varies: "outcome",
  heft: 2,
  about:
    "The same endpoint refusing. The token differs from the accepted one by " +
    "its last character, so the comparison walks the whole string and this " +
    "row measures the refusal path rather than a length check.",

  request: (c) => c.get(path).header("authorization", `Bearer ${wrong}`).status(403),
});
