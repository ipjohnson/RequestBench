import { performanceTest } from "#kit";
import { items } from "#payloads";

const path = "/compressed/small";

export default performanceTest({
  id: { family: "compressed", name: "gzip_small" },
  path,
  base: "compressed.identity_small",
  varies: "compression",
  about:
    "The middleware actually asked to compress, on a body too small to " +
    "benefit. Whether a framework bothers is the point, so this row does not " +
    "assert that the answer came back compressed; it asserts the answer is " +
    "right either way.",

  request: (c) =>
    c
      .get(path)
      .header("accept-encoding", "gzip")
      .header("cache-control", "no-cache")
      .okWith(items.small)
      .fresh(),
});
