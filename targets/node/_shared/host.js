// What sits between the host and the framework, and which version of it.
//
// A host adapter can move a target's numbers with the framework version unchanged, and
// then nothing recorded explains the step. The adapter names itself here rather than each
// app guessing, because which one a target gets under lambda-rie is decided in
// _hosts/lambda-entry.mjs and depends on the target.
import { pkgVersion } from "./version.js";

let adapter = "";

export function useAdapter(name) {
  const v = pkgVersion(name);
  adapter = v ? `${name} ${v}` : name;
}

// Called per request rather than read at import: a host adapter names itself after it has
// already imported the app module, so the value is not there yet when meta is built.
export function hostMeta() {
  return { adapter };
}
