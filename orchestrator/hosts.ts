// The hosts a framework can be measured on. The set is the benchmark's, so it is a list here
// rather than something a framework declares; a framework says which of these it implements in
// rb.json, and one it leaves out is one it does not implement.
//
// A host owns how a framework is started, how it is reached and how load is sent. Adding one
// should touch this record, the transports that speak its protocol and the frameworks that opt
// in, and nothing else. Each host is its own run, and results are keyed framework@host.
//
// A framework keeps what one host needs, its Dockerfile and any start-up code, in the directory
// the host's `dir` names, and describes it in the rb.json entry of that name. Hosts that run the
// same image under different limits, as the two Lambda hosts do, share a `dir`. Every host offers
// every test; a framework that cannot answer one on a host lists it under that entry's
// `unsupported`. A framework that cannot run on one of the hosts sharing a `dir` names it in
// rb.json's `optOut`.

export interface Host {
  readonly id: string;
  /** The directory a framework keeps this host's Dockerfile and start-up code in, and the key of its entry under `hosts` in rb.json. */
  readonly dir: string;
  /** What the validating client and the traffic generator speak to it. */
  readonly protocol: "http/1.1" | "h2c" | "lambda-runtime-api";
  /** How a framework is started on it. */
  readonly start: "container";
  /**
   * For an open-loop load, the connections the generator holds and the requests each carries at
   * once. Their product is the in-flight limit past which an instance is dropped.
   */
  readonly load?: { readonly connections: number; readonly streams: number };
  /**
   * A function's memory in MB. Its container is limited to it with no swap, and its runtime is told
   * it in AWS_LAMBDA_FUNCTION_MEMORY_SIZE, which the Node, Java and .NET bootstraps size their heap from.
   */
  readonly memoryMb?: number;
  readonly about: string;
  /** How a framework runs here, as the explorer's intro lists the hosts. */
  readonly brief: string;
}

/** The function on one core with `memoryMb`. Every size runs the image the framework's lambda-emulator/ builds. */
const lambdaEmulator = <const Id extends string>(id: Id, memoryMb: number) =>
  ({
    id,
    dir: "lambda-emulator",
    protocol: "lambda-runtime-api",
    start: "container",
    memoryMb,
    about:
      `The framework as a Lambda function on its language's AWS base image, in a container limited to ` +
      `${memoryMb.toLocaleString("en-GB")} MB and one core. The traffic generator serves the Lambda Runtime API ` +
      "in place of Lambda, and the function's own runtime client asks it for each event, an API Gateway " +
      "payload format 2.0 request.",
    brief: `as a Lambda function with ${memoryMb.toLocaleString("en-GB")} MB`,
  }) as const;

export const HOSTS = {
  "container-h1": {
    id: "container-h1",
    dir: "container-h1",
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
    dir: "container-h2",
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
  "lambda-emulator-512": lambdaEmulator("lambda-emulator-512", 512),
  "lambda-emulator-1024": lambdaEmulator("lambda-emulator-1024", 1024),
} as const satisfies Record<string, Host>;

export type HostId = keyof typeof HOSTS;

export const isHostId = (id: string): id is HostId => Object.hasOwn(HOSTS, id);

export const HOST_IDS = Object.keys(HOSTS) as HostId[];

/** Each host's `dir` once: the keys an rb.json `hosts` may have. */
export const HOST_DIRS: readonly string[] = [...new Set(HOST_IDS.map((h) => HOSTS[h].dir))];

/** A framework's rb.json entry for a host, which every host with the same `dir` reads. */
export const entryOf = <E>(entries: Readonly<Record<string, E>>, host: HostId): E | undefined => entries[HOSTS[host].dir];

/** The hosts a framework implements: each host whose `dir` its rb.json has an entry for. */
export const hostsOf = (entries: Readonly<Record<string, unknown>>): HostId[] => HOST_IDS.filter((h) => Object.hasOwn(entries, HOSTS[h].dir));

/** What of an rb.json says where a framework runs. */
interface Placed {
  readonly hosts: Readonly<Record<string, unknown>>;
  readonly optOut?: Readonly<Record<string, string>> | undefined;
}

/** Whether a framework is validated and measured on `host`: it implements the host and does not opt out of it. */
export const runsOn = (rb: Placed, host: HostId): boolean => Object.hasOwn(rb.hosts, HOSTS[host].dir) && !Object.hasOwn(rb.optOut ?? {}, host);
