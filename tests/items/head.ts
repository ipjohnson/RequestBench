import { performanceTest } from "#kit";

const path = "/items/{draw.item}";

export default performanceTest({
  id: { family: "items", name: "head" },
  path,
  base: "items.read",
  varies: "method",
  about:
    "The same lookup asked with HEAD, which the framework answers from its GET " +
    "route with no body. Read against items.read, the difference is the body " +
    "left unwritten. Content-Length is not checked, because a framework that " +
    "streams its JSON sends none on the GET either.",

  request: (c) => c.head(`/items/${c.draw.item()}`).ok().hasHeader("content-type", /^application\/json/).emptyBody(),
});
