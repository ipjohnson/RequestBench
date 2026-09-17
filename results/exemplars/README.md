# Captured exemplars

One request/response pair per endpoint per target, recorded by the conformance gate rather
than during a timed run, so capturing costs nothing.

These live on `main` beside the targets, not on the `results` branch, because they change
only when a target changes. A pull request that alters what a framework puts on the wire
shows it here as a diff: a new header, a different framing, a byte more or less of body.

Regenerate with `make exemplars`, which narrows the same way a run does (TARGETS=,
LANGUAGES=, FRAMEWORKS=). Against a target booted by hand:

    node client/dist/cli.js 127.0.0.1:8080 --target <language>:<target> \
      --exemplars results/exemplars/<language>-<target>@container.json
