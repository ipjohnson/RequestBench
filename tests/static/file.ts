import { performanceTest } from "#kit";
import { file } from "#payloads";

const path = "/static/items.large.json";
const BYTES = new TextEncoder().encode(file.value).length;

export default performanceTest({
  id: { family: "static", name: "file" },
  path,
  base: "json.large",
  varies: "static_file",
  about:
    "items.large.json sent by the framework's static-file feature from the " +
    "payload directory, byte for byte, with its length and its modification " +
    "time. This is the one row where serving the file's bytes is the point. " +
    "Last-Modified is checked rather than an ETag, because Go's file server " +
    "sends no ETag.",

  request: (c) =>
    c
      .get(path)
      .okWith(file)
      .hasHeader("content-type", /^application\/json/)
      .hasHeader("content-length", String(BYTES))
      .hasHeader("last-modified"),
});
