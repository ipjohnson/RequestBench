// The hosts a framework can be measured on. The set is the benchmark's, so it is a list here
// rather than something a framework declares; a framework says which of these it implements in
// rb.json, and one it leaves out is one it does not implement.
//
// A host owns how a framework is started, how it is reached and how load is sent. Adding one
// should touch this record, the transports that speak its protocol and the frameworks that opt
// in, and nothing else. Each host is its own run, and results are keyed framework@host.
//
// A framework keeps what one host needs, its Dockerfile and any start-up code, in a directory
// named for the host. Every host offers every test; a framework that cannot answer one on a host
// lists it under that host's `unsupported` in rb.json.

export interface Host {
  readonly id: string;
  /** What the validating client and the traffic generator speak to it. */
  readonly protocol: "http/1.1" | "h2c" | "lambda-runtime-api";
  /** How a framework is started on it. */
  readonly start: "container";
  /**
   * For an open-loop load, the connections the generator holds and the requests each carries at
   * once. Their product is the in-flight limit past which an instance is dropped.
   */
  readonly load?: { readonly connections: number; readonly streams: number };
  readonly about: string;
  /** How a framework runs here, as the explorer's intro lists the hosts. */
  readonly brief: string;
}

export const HOSTS = {
  "container-h1": {
    id: "container-h1",
    protocol: "http/1.1",
    start: "container",
    load: { connections: 256, streams: 1 },
    about:
      "The framework's image in a container, reached over HTTP/1.1. The name carries the protocol, so " +
      "HTTP/2 arrives as container-h2 beside it rather than as a rename.",
    brief: "in a container over HTTP/1.1",
  },
  "container-h2": {
    id: "container-h2",
    protocol: "h2c",
    start: "container",
    // container-h1's 256 in flight, and below every server's default stream limit, Kestrel's
    // 100 the lowest, so every framework is offered the same shape.
    load: { connections: 16, streams: 16 },
    about:
      "The framework's image in a container, reached over HTTP/2 with prior knowledge and no TLS, so it " +
      "differs from container-h1 in the protocol alone. A framework whose server speaks only HTTP/1.1 runs " +
      "on another server here, and its page says which.",
    brief: "in a container over HTTP/2",
  },
  "lambda-emulator": {
    id: "lambda-emulator",
    protocol: "lambda-runtime-api",
    start: "container",
    about:
      "The framework as a Lambda function on its language's AWS base image. The traffic generator serves " +
      "the Lambda Runtime API in place of Lambda, and the function's own runtime client asks it for each " +
      "event, an API Gateway payload format 2.0 request.",
    brief: "as a Lambda function",
  },
} as const satisfies Record<string, Host>;

export type HostId = keyof typeof HOSTS;

export const isHostId = (id: string): id is HostId => Object.hasOwn(HOSTS, id);

export const HOST_IDS = Object.keys(HOSTS) as HostId[];
