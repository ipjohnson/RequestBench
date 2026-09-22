// The hosts a framework can be measured on. The set is the benchmark's, so it is a list here
// rather than something a framework declares; a framework says which of these it implements in
// rb.json, and one it leaves out is one it does not implement.
//
// A host owns how a framework is started, how it is reached and how load is sent. Adding one
// should touch this record, the transports that speak its protocol and the frameworks that opt
// in, and nothing else. Each host is its own run, and results are keyed framework@host.

export interface Host {
  readonly id: string;
  /** What the validating client and the traffic generator speak to it. */
  readonly protocol: "http/1.1";
  /** How a framework is started on it. */
  readonly start: "container";
  readonly about: string;
}

export const HOSTS = {
  "container-h1": {
    id: "container-h1",
    protocol: "http/1.1",
    start: "container",
    about:
      "The framework's image in a container, reached over HTTP/1.1. The name carries the protocol, so " +
      "HTTP/2 arrives as container-h2 beside it rather than as a rename.",
  },
} as const satisfies Record<string, Host>;

export type HostId = keyof typeof HOSTS;

export const isHostId = (id: string): id is HostId => Object.hasOwn(HOSTS, id);
