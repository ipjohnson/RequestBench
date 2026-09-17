// java:spring-boot's error contract.
//
// What it answers today comes from the shared validator in _shared/domain rather than from
// its own facility, which is the defect #35 describes. The envelope is written here because
// it is this framework's answer: when its own validation goes in, this file is rewritten --
// including the statuses, if its binder and its validator fail at different layers -- and
// nothing outside this directory changes.
import {
  errorEnvelope, z,
  type Ask, type ExceptionPackage,
} from "@rb/schema";

const envelope = (body: z.ZodType<unknown>) => (ask: Ask) => errorEnvelope(ask, body);

/** A refusal that names no field: denied, not found, no route. */
const bare = z.object({ error: z.string().min(1) }).strict();

/** A rejected body, with one entry per field the validator refused. */
const validation = z
  .object({
    error: z.string().min(1),
    errors: z.array(z.object({ field: z.string(), rule: z.string() }).strict()).min(1),
  })
  .strict();

export default {
  target: "java:spring-boot",
  because:
    "Validates by calling the shared validator in _shared/domain rather than its own " +
    "facility, so it answers this repository's envelope instead of the framework's, and " +
    "one status for every kind of bad body. See issue #35.",
  schemas: {
    "authorized.denied": envelope(bare),
    "errors.not_found": envelope(bare),
    "errors.unmatched": envelope(bare),
    "body.rejected_all": envelope(validation),
    "body.rejected_first": envelope(validation),
    "errors.malformed": envelope(validation),
  },
} satisfies ExceptionPackage;
