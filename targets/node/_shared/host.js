// What sits between the host and the framework, and which version of it.
//
// A host adapter can move a target's numbers with the framework version unchanged, and
// then nothing recorded explains the step. The adapter names itself here rather than each
// app guessing, because which one a target gets under lambda-rie is decided in
// _hosts/lambda-entry.mjs and depends on the target.
import { pkgVersion } from "./version.js";

let adapter = "";
let bootMs;

export function useAdapter(name) {
  const v = pkgVersion(name);
  adapter = v ? `${name} ${v}` : name;
}

// Called by a host that runs the framework's own server, once it is listening. Node counts
// performance.now() from the start of the process, so this covers the runtime's own start
// as well as the framework's. A function host is started by its runtime, never calls it,
// and reports no boot_ms.
export function listening() {
  bootMs = Math.round(performance.now() * 10) / 10;
}

// Called per request rather than read at import: a host adapter names itself after it has
// already imported the app module, so the value is not there yet when meta is built.
export function hostMeta() {
  return bootMs === undefined ? { adapter } : { adapter, boot_ms: bootMs };
}
