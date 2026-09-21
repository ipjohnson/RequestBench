import { performanceTest } from "#kit";
import { items } from "#payloads";

const path = "/compressed/large";

export default performanceTest({
  id: { family: "compressed", name: "gzip_large" },
  path,
  about:
    "The middleware compressing a body large enough to be worth it. Read " +
    "against compressed.identity_large, the difference is the compression and " +
    "nothing else, because both rows carry the same wiring.",

  request: (c) =>
    c
      .get(path)
      .header("accept-encoding", "gzip")
      .header("cache-control", "no-cache")
      .okWith(items.large, { compressed: true })
      .fresh(),
});
