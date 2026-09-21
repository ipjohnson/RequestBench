import { performanceTest } from "#kit";
import { items } from "#payloads";

const path = "/compressed/small";

export default performanceTest({
  id: { family: "compressed", name: "identity_small" },
  path,
  about:
    "The compression middleware installed and declining. The client asks for " +
    "identity, so nothing is compressed and what this row carries is the cost " +
    "of the wiring being in the path at all. It is what the gzip arm is " +
    "subtracted from.",

  request: (c) =>
    c
      .get(path)
      .header("accept-encoding", "identity")
      .header("cache-control", "no-cache")
      .okWith(items.small, { compressed: false })
      .fresh(),
});
