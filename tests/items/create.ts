import { performanceTest } from "#kit";
import { CREATED, created, items } from "#payloads";

const path = "/items";

/** Relative, or absolute on whatever host the framework thinks it is. */
const LOCATION = new RegExp(`^(https?://[^/]+)?/items/${CREATED}$`);

export default performanceTest({
  id: { family: "items", name: "create" },
  path,
  about:
    "A new item posted as JSON and answered 201, with where it would live and " +
    "what it would hold. Nothing is stored, so the answer is always the id " +
    "after the last row. Read against body.bind_small, the difference is a " +
    "body bound to a model and answered as a created resource rather than " +
    "echoed with counts.",

  request: (c) => c.post(path, items.new.value).status(201).bodyIs(created).hasHeader("location", LOCATION),
});
