import { performanceTest } from "#kit";
import { files } from "#payloads";

const path = "/static/items.medium.json";

export default performanceTest({
  id: { family: "static", name: "medium" },
  path,
  base: "json.medium",
  varies: "static_file",
  heft: 2,
  about:
    "items.medium.json sent by the same static-file feature, with its " +
    "modification time, to a request that accepts gzip. Read against " +
    "json.medium, the difference is the file served against the same 89 rows " +
    "serialised, and against static.small it is the feature's cost per byte.",

  request: (c) =>
    c
      .get(path)
      .header("accept-encoding", "gzip")
      .okWith(files.medium)
      .hasHeader("content-type", /^application\/json/)
      .hasHeader("last-modified"),
});
