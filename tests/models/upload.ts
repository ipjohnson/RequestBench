import { z } from "zod";

/** What forms.multipart answers beside its echo: the file part as the handler received it. */
export const upload = z.strictObject({
  file: z.strictObject({
    /** The part's filename. */
    name: z.string().min(1),
    bytes: z.number().int().positive(),
  }),
});
