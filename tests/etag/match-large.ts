import { performanceTest } from "#kit";

const path = "/etag/large";

export default performanceTest({
  id: { family: "etag", name: "match_large" },
  path,
  base: "etag.large",
  varies: "conditional",
  about:
    "The only row that cannot be sent until the framework has answered a " +
    "different one: the validator is the framework's to produce. A 304 saves " +
    "the write and nothing else, because the body is built and hashed before " +
    "anything is compared.",

  request: async (c) => {
    const tag = await c.once(path, () => c.get(path).etag());

    return c.get(path).header("if-none-match", tag).notModified().emptyBody();
  },
});
