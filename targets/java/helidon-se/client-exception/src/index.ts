// java:helidon-se answers this repository's error envelope, because it still validates by
// calling the shared validator in _shared/domain rather than its own facility.
//
// When it moves to its own (#35), the envelope it then answers is written here and nothing
// outside this directory changes.
import { sharedValidatorEnvelope } from "@rb/schema";

export default sharedValidatorEnvelope("java:helidon-se");
