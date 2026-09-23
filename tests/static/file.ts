import { performanceTest } from "#kit";
import { file } from "#payloads";

const path = "/static/items.large.json";

export default performanceTest({
  id: { family: "static", name: "file" },
  path,
  base: "json.large",
  varies: "static_file",
  about:
    "items.large.json sent by the framework's static-file feature from the " +
    "payload directory, with its modification time. The request accepts gzip, " +
    "as a browser's does, and the body is compared byte for byte after " +
    "decoding, so the file may go out as it is or compressed. This is the one " +
    "row where serving the file's bytes is the point. Last-Modified is checked " +
    "rather than an ETag, because Go's file server sends no ETag.",

  request: (c) =>
    c
      .get(path)
      .header("accept-encoding", "gzip")
      .okWith(file)
      .hasHeader("content-type", /^application\/json/)
      .hasHeader("last-modified"),
});
