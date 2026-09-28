import { performanceTest } from "#kit";
import { files } from "#payloads";

const path = "/static/items.small.json";

export default performanceTest({
  id: { family: "static", name: "small" },
  path,
  base: "json.small",
  varies: "static_file",
  heft: 1,
  about:
    "items.small.json sent by the same static-file feature, with its " +
    "modification time, to a request that accepts gzip. The file is one row, " +
    "so what is left is the feature's own cost per request: finding the file, " +
    "reading its metadata and writing its headers.",

  request: (c) =>
    c
      .get(path)
      .header("accept-encoding", "gzip")
      .okWith(files.small)
      .hasHeader("content-type", /^application\/json/)
      .hasHeader("last-modified"),
});
