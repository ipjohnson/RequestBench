import { z } from "zod";
import { exceptions } from "@rb/tests/kit";

/**
 * Quarkus's violation report, which quarkus-hibernate-validator writes for a REST method whose
 * @Valid parameter broke a rule. Each violation names its field by Hibernate Validator's property
 * path, which starts with the method and the parameter. Every other refusal is Quarkus's without a
 * JSON body: a body Jackson cannot read, a missing row and a method the path lacks answer with none,
 * and a path no route matches answers Vert.x's HTML page.
 */
const Envelope = z.object({
  title: z.string(),
  status: z.number(),
  violations: z.array(z.object({ field: z.string(), message: z.string() })),
});

/** `validateSmall.order.lines[0].qty` -> `lines.0.qty` */
const fromPath = (path: string): string =>
  path
    .split(".")
    .slice(2)
    .join(".")
    .replace(/\[(\d+)\]/g, ".$1");

export default exceptions({
  about:
    "Quarkus's violation report. Hibernate Validator's failures answer 400 and are listed under " +
    "violations, each named by its property path after the method and the parameter. A body Jackson " +
    "cannot read never reaches the validator, and answers 400 with no body.",
  rejected: 400,
  malformed: 400,
  notFound: 404,
  wrongMethod: 405,
  envelope: Envelope,
  fields: (b) => b.violations.map((v) => fromPath(v.field)),
  message: (b, f) => b.violations.find((v) => fromPath(v.field) === f)?.message,
});
