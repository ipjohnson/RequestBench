import { performanceTest } from "#kit";
import type { RunValues } from "#kit";
import { forms, uploaded } from "#payloads";

const path = "/forms/multipart";
const BOUNDARY = "rb-7c4f1e0a9d";

function part(disposition: string, body: string, type?: string): string {
  const typed = type === undefined ? "" : `Content-Type: ${type}\r\n`;
  return `--${BOUNDARY}\r\nContent-Disposition: form-data; ${disposition}\r\n${typed}\r\n${body}\r\n`;
}

/** Built once per run's values, so the 32 KB concatenation is not inside every instance's timed window. */
const bodies = new WeakMap<RunValues, string>();

function multipart(run: RunValues): string {
  let body = bodies.get(run);
  if (body === undefined) {
    body =
      part('name="tenant"', run.tenant) +
      part('name="requestId"', run.requestId) +
      part(`name="file"; filename="${forms.file.name}"`, forms.file.value, "text/plain") +
      `--${BOUNDARY}--\r\n`;
    bodies.set(run, body);
  }
  return body;
}

export default performanceTest({
  id: { family: "forms", name: "multipart" },
  path,
  base: "forms.urlencoded",
  varies: "multipart",
  about:
    "A multipart/form-data upload of two fields and a 32 KB text file. The " +
    "handler echoes the fields and answers the file's name and byte count, so " +
    "it has to have read the whole part. Read against forms.urlencoded, the " +
    "difference is the multipart parser and a body of 32 KB instead of a " +
    "line.",

  request: (c) =>
    c
      .post(path)
      .raw(multipart(c.run), `multipart/form-data; boundary=${BOUNDARY}`)
      .okWith(uploaded, { echo: ["tenant", "requestId"] }),
});
