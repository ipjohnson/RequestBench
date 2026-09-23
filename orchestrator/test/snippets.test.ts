// The snippets port on small sources shaped like the frameworks it reads: one case per rule a
// framework leans on, and each assertion and requirement both firing and holding. The parity
// script checks the same rules against upstream's thirty-three targets.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assess,
  failing,
  requirements,
  resolve,
  splitLines,
  type Endpoint,
  type Failures,
  type Mechanism,
  type SnippetRecord,
  type SourceFile,
} from "../snippets.ts";

const ep = (id: string, method: string, path: string, base?: string): Endpoint => ({
  id,
  family: id.slice(0, id.indexOf(".")),
  method,
  path,
  ...(base === undefined ? {} : { base }),
});
const src = (path: string, lines: readonly string[], role = "source"): SourceFile => ({
  path,
  text: `${lines.join("\n")}\n`,
  hash: `sha256:${path}`,
  role,
});
const run = (language: string, files: readonly SourceFile[], endpoints: readonly Endpoint[]) =>
  resolve({ target: "x:y", language, files, endpoints });
const span = (rec: SnippetRecord | undefined): [number, number] | null =>
  rec?.handler ? [rec.handler.startLine, rec.handler.endLine] : null;

test("lines split the way Python's str.splitlines() splits them", () => {
  const ls = String.fromCharCode(0x2028);
  assert.deepEqual(splitLines("a\r\nb\rc\n"), ["a", "b", "c"]);
  assert.deepEqual(splitLines(`a${ls}b\x0bc\x1ed`), ["a", "b", "c", "d"]);
  assert.deepEqual(splitLines("a\x1fb"), ["a\x1fb"]);
  assert.deepEqual(splitLines(""), []);
  assert.deepEqual(splitLines("\n"), [""]);
  assert.deepEqual(splitLines("a\n\nb\n"), ["a", "", "b"]);
});

test("C# names the method in the call, so a GET and a PUT on one route go to different endpoints", () => {
  const { found, problems } = run(
    "dotnet",
    [
      src("Program.cs", [
        "var app = WebApplication.Create(args);",
        'app.MapGet("/items/{id:int}", (int id) => Items.Read(id));',
        'app.MapPost("/items", (NewItem item) => Items.Create(item));',
        'app.MapPut("/items/{id:int}", (int id, NewItem item) => Items.Replace(id, item));',
      ]),
    ],
    [ep("items.read", "GET", "/items/{draw.item}"), ep("items.create", "POST", "/items"), ep("items.replace", "PUT", "/items/{draw.item}")],
  );
  assert.deepEqual(problems, []);
  assert.deepEqual(span(found["items.read"]), [2, 2]);
  assert.deepEqual(span(found["items.create"]), [3, 3]);
  assert.deepEqual(span(found["items.replace"]), [4, 4]);
});

test("a Java annotation that does not end a statement runs on through the method it annotates", () => {
  const { found } = run(
    "java",
    [
      src("JsonController.java", [
        "@RestController",
        "public class JsonController {",
        '    @GetMapping("/json/small")',
        "    public Payload small() {",
        "        return payloads.small();",
        "    }",
        "}",
      ]),
    ],
    [ep("json.small", "GET", "/json/small")],
  );
  assert.deepEqual(span(found["json.small"]), [3, 6]);
  assert.equal(found["json.small"]!.handler!.how, "derived");
});

test("a Rust lifetime is not an open quote, so the handler's brace is still counted", () => {
  const { found } = run(
    "rust",
    [
      src("src/main.rs", [
        '#[get("/json/small")]',
        "fn json_small(state: &State<Payloads>) -> Json<&'static Payload> {",
        "    Json(&state.small)",
        "}",
      ]),
    ],
    [ep("json.small", "GET", "/json/small")],
  );
  assert.deepEqual(span(found["json.small"]), [1, 4]);
});

test("a Rust raw string is a string and its # opens no comment, so the handler's delimiters still balance", () => {
  const { found } = run(
    "rust",
    [
      src("src/main.rs", [
        '#[post("/body/validate/small")]',
        "async fn validate_small() -> Response {",
        '    let refused = post(&app(), r#"{"customerId": 1, "lines": ["#).await;',
        '    let quoted = br##"one " and a {"##;',
        "    answer(refused, quoted)",
        "}",
        "",
        '#[get("/json/small")]',
        "fn json_small() -> &'static str {",
        '    "small"',
        "}",
      ]),
    ],
    [ep("body.validate_small", "POST", "/body/validate/small"), ep("json.small", "GET", "/json/small")],
  );
  assert.deepEqual(span(found["body.validate_small"]), [1, 6]);
  assert.deepEqual(span(found["json.small"]), [8, 11]);
});

test("a Python decorator extends onto the async def under it, which ends where the source dedents", () => {
  const { found } = run(
    "python",
    [
      src("app.py", [
        '@app.get("/json/small")',
        "async def json_small():",
        "    return payloads.small",
        "",
        "",
        '@app.get("/json/large")',
        "async def json_large():",
        "    return payloads.large",
      ]),
    ],
    [ep("json.small", "GET", "/json/small"), ep("json.large", "GET", "/json/large")],
  );
  assert.deepEqual(span(found["json.small"]), [1, 3]);
  assert.deepEqual(span(found["json.large"]), [6, 8]);
});

test("gin's :param captures match the corpus's {run.one}, and the block ends where its delimiters balance", () => {
  const { found } = run(
    "go",
    [
      src("main.go", [
        "func routes(r *gin.Engine) {",
        '\tr.GET("/parameters/:one/with-second/:two", func(c *gin.Context) {',
        "\t\tc.JSON(200, payloads.Small)",
        "\t})",
        "}",
      ]),
    ],
    [ep("parameters.two", "GET", "/parameters/{run.one}/with-second/{run.two}?page={run.page}")],
  );
  assert.deepEqual(span(found["parameters.two"]), [2, 4]);
});

test("a Node route with a handler body, and a route named in a comment is not a registration", () => {
  const { found, problems } = run(
    "node",
    [
      src("app.js", [
        '// app.get("/json/small") used to be registered here',
        'app.get("/json/small", async () => {',
        "  return payloads.small;",
        "});",
        'app.post("/body/bind/small", async (request) => bind(request.body));',
      ]),
    ],
    [ep("json.small", "GET", "/json/small"), ep("body.bind_small", "POST", "/body/bind/small")],
  );
  assert.deepEqual(problems, []);
  assert.deepEqual(span(found["json.small"]), [2, 4]);
  assert.deepEqual(span(found["body.bind_small"]), [5, 5]);
});

test("an OpenAPI path is a key, and what it serves is the block indented under it", () => {
  const { found } = run(
    "node",
    [
      src(
        "openapi.yaml",
        ["paths:", '  "/json/small":', "    get:", "      operationId: jsonSmall", '  "/json/large":', "    get:", "      operationId: jsonLarge"],
        "contract",
      ),
    ],
    [ep("json.small", "GET", "/json/small"), ep("json.large", "GET", "/json/large")],
  );
  assert.deepEqual(span(found["json.small"]), [2, 4]);
  assert.deepEqual(span(found["json.large"]), [5, 7]);
});

test("rb:end closes wiring the block rule would stop short of, and the wiring hangs off every endpoint of its family", () => {
  const { found } = run(
    "node",
    [
      src("app.js", [
        "// rb:wiring compressed.*",
        'const compression = require("compression");',
        "app.use(compression({ threshold: 0 }));",
        "// rb:end",
        'app.get("/compressed/small", (req, res) => res.json(payloads.small));',
        'app.get("/compressed/large", (req, res) => res.json(payloads.large));',
      ]),
    ],
    [ep("compressed.small", "GET", "/compressed/small"), ep("compressed.large", "GET", "/compressed/large")],
  );
  for (const id of ["compressed.small", "compressed.large"]) {
    const [wiring] = found[id]!.support;
    assert.deepEqual([wiring!.startLine, wiring!.endLine, wiring!.how, wiring!.scope], [2, 3, "marker", "family"]);
  }
  assert.deepEqual(span(found["compressed.small"]), [5, 5]);
});

test("a route registered twice is a problem rather than a first match", () => {
  const { found, problems } = run(
    "node",
    [src("app.js", ['app.get("/json/small", small);', 'app.get("/json/small", alsoSmall);'])],
    [ep("json.small", "GET", "/json/small")],
  );
  assert.deepEqual(problems, ["x:y json.small matches in 2 places: app.js:1, app.js:2"]);
  assert.equal(found["json.small"], undefined);
});

test("an endpoint with no route of its own is answered by its base's route only when it is an instance of it", () => {
  const { found } = run(
    "node",
    [src("app.js", ['app.get("/items/:id", read);'])],
    [
      ep("items.read", "GET", "/items/{draw.item}"),
      ep("errors.not_found", "GET", "/items/999999", "items.read"),
      ep("json.small", "GET", "/json/small"),
      ep("errors.unmatched", "GET", "/errors/unmatched", "json.small"),
    ],
  );
  assert.deepEqual(span(found["errors.not_found"]), [1, 1]);
  assert.equal(found["errors.unmatched"], undefined);
});

test("a marked fragment that does not name its route carries the blocks it sits in as context", () => {
  const { found, problems } = run(
    "node",
    [
      src("app.js", [
        'router.get("/items/:id", (req, res) => {',
        "  switch (req.query.kind) {",
        "    // rb:handler items.head",
        '    case "head":',
        "      res.end();",
        "      break;",
        "  }",
        "});",
      ]),
    ],
    [ep("items.read", "GET", "/items/{draw.item}"), ep("items.head", "HEAD", "/items/{draw.item}")],
  );
  assert.deepEqual(problems, []);
  assert.deepEqual(span(found["items.read"]), [1, 8]);
  const head = found["items.head"]!.handler!;
  assert.deepEqual([head.startLine, head.endLine, head.how], [4, 6, "marker"]);
  assert.deepEqual(head.context, [
    { line: 1, text: 'router.get("/items/:id", (req, res) => {' },
    { line: 2, text: "  switch (req.query.kind) {" },
  ]);
});

test("a mark naming nothing, a kind that does not exist, or a file the kind may not read is a problem", () => {
  const { problems } = run(
    "node",
    [src("app.js", ["// rb:handler nope.nothing", "// rb:bogus json.small", "// rb:test json.small", 'app.get("/json/small", small);'])],
    [ep("json.small", "GET", "/json/small")],
  );
  assert.deepEqual(problems, [
    "x:y rb:handler nope.nothing names no endpoint (app.js:1)",
    "x:y rb:bogus is not a kind in orchestrator/marks.ts (app.js:2)",
    "x:y rb:test reads test files and this one is source (app.js:3)",
  ]);
});

const JAVA = src("Json.java", [
  "// rb:handler json.small",
  '@GetMapping("/json/small")',
  "// rb:end",
  "public Payload small() { return payloads.small(); }",
  '@GetMapping("/json/large")',
  "public Payload large() { return payloads.large(); }",
]);

test("not_only_annotations fires on a handler that is nothing but its annotation, and holds on a declaration", () => {
  const endpoints = [ep("json.small", "GET", "/json/small"), ep("json.large", "GET", "/json/large")];
  const { found } = run("java", [JAVA], endpoints);
  assert.deepEqual(span(found["json.small"]), [2, 2]);
  assert.deepEqual(span(found["json.large"]), [5, 6]);
  const failed = assess({ found, endpoints, mechanisms: {} });
  assert.deepEqual(failed.not_only_annotations, ["json.small"]);
});

test("mentions_dep fires when the wiring does not name its dependency, and `mentions` stands in for it", () => {
  const endpoints = [ep("compressed.small", "GET", "/compressed/small")];
  const { found } = run(
    "node",
    [
      src("app.js", [
        "// rb:wiring compressed.*",
        'app.use(require("compression")());',
        'app.get("/compressed/small", (req, res) => res.json(payloads.small));',
      ]),
    ],
    endpoints,
  );
  const failing = (decl: Mechanism) => assess({ found, endpoints, mechanisms: { compressed: decl } }).mentions_dep;
  assert.deepEqual(failing({ mechanism: "compression middleware", dependency: "compression" }), []);
  assert.deepEqual(failing({ mechanism: "compression middleware", dependency: "shrink-ray" }), ["compressed"]);
  assert.deepEqual(failing({ mechanism: "compression middleware", dependency: "shrink-ray", mentions: "compression" }), []);
  assert.deepEqual(failing({ builtin: "the server compresses" }), []);
});

test("no_test counts endpoints without a test of their own, and names_endpoint a test that does not name its endpoint", () => {
  const endpoints = [ep("json.small", "GET", "/json/small"), ep("json.large", "GET", "/json/large"), ep("json.medium", "GET", "/json/medium")];
  const { found } = run(
    "node",
    [
      src("app.js", ['app.get("/json/small", small);', 'app.get("/json/large", large);', 'app.get("/json/medium", medium);']),
      src(
        "suite/app.test.js",
        [
          "// rb:test json.small",
          'test("json.small answers the small payload", async () => {',
          '  await get("/json/small");',
          "});",
          "// rb:test json.large",
          'test("the large payload", async () => {',
          '  await get("/json/large");',
          "});",
          "// rb:test json.*",
          "function helper() {}",
        ],
        "test",
      ),
    ],
    endpoints,
  );
  assert.deepEqual(
    found["json.medium"]!.test.map((p) => p.scope),
    ["family"],
  );
  const failed = assess({ found, endpoints, mechanisms: {} });
  assert.deepEqual(failed.no_test, ["json.medium"]);
  assert.deepEqual(failed.names_endpoint, ["json.large"]);
});

test("the declared requirement holds rb.json to what is marked, and every required endpoint has to be located", () => {
  const endpoints = [ep("json.small", "GET", "/json/small"), ep("json.large", "GET", "/json/large")];
  const wired = run("node", [src("app.js", ["// rb:wiring json.*", "app.register(fastJson);", 'app.get("/json/small", small);'])], endpoints).found;
  const bare = run("node", [src("app.js", ['app.get("/json/small", small);'])], endpoints).found;
  const req = (found: Record<string, SnippetRecord>, mechanisms: Record<string, Mechanism>, manifestText = "", required = ["json.small"]) =>
    requirements({ target: "x:y", found, endpoints, required: new Set(required), mechanisms, manifestText });

  assert.deepEqual(req(bare, {}), ["x:y declares no mechanism for json in rb.json"]);
  assert.deepEqual(req(bare, { json: { mechanism: "fast-json" } }), ["x:y declares fast-json for json and marks no wiring for it"]);
  assert.deepEqual(req(wired, { json: { mechanism: "fast-json", dependency: "fast-json" } }), [
    "x:y declares fast-json for json and no manifest names it",
  ]);
  assert.deepEqual(req(wired, { json: { mechanism: "fast-json", dependency: "fast-json" } }, '"fast-json": "6.0.0"'), []);
  assert.deepEqual(req(wired, { json: { builtin: "the framework serialises on its own" } }), [
    "x:y declares json built in and marks 1 wiring part(s) for it",
  ]);
  assert.deepEqual(req(bare, { json: { builtin: "the framework serialises on its own" } }), []);
  assert.deepEqual(req(bare, { json: { mentions: "fast-json" } }), ["x:y declares neither a mechanism nor builtin for json"]);
  assert.deepEqual(req(bare, { json: { builtin: "on its own" } }, "", ["json.small", "json.large"]), [
    "x:y is conformance-required and locates a handler for only 1/2 endpoints",
  ]);
});

test("an endpoint in noHandler derives nothing, keeps its record for its tests, and owes no handler", () => {
  const endpoints = [
    ep("items.create", "POST", "/items"),
    ep("errors.wrong_method", "POST", "/items/{draw.item}"),
    ep("errors.unmatched", "GET", "/errors/unmatched"),
  ];
  const app = src("app.js", ['app.post("/items", create);', "function create(req, res) {", '  res.location("/items/:id");', "}"]);
  const suite = src("test/app.test.js", ["// rb:test errors.wrong_method", 'test("errors.wrong_method", () => post("/items/17").expect(405));'], "test");
  const noHandler = new Set(["errors.wrong_method", "errors.unmatched"]);
  const mechanisms = { items: { builtin: "on its own" }, errors: { builtin: "the router" } };
  const req = (found: Record<string, SnippetRecord>) =>
    requirements({ target: "x:y", found, endpoints, required: new Set(endpoints.map((e) => e.id)), mechanisms, manifestText: "", noHandler });

  // Without the declaration, a Location header reads as the route a wrong method is refused on.
  assert.deepEqual(span(run("node", [app], endpoints).found["errors.wrong_method"]), [3, 3]);

  const { found, problems } = resolve({ target: "x:y", language: "node", files: [app, suite], endpoints, noHandler });
  assert.deepEqual(problems, []);
  assert.equal(found["errors.wrong_method"]!.handler, null);
  assert.equal(found["errors.wrong_method"]!.test.length, 1);
  assert.equal(found["errors.unmatched"]!.handler, null);
  assert.deepEqual(req(found), []);
  assert.deepEqual(assess({ found, endpoints, mechanisms }).no_test, ["errors.unmatched", "items.create"]);

  const marked = src("app.js", ['app.post("/items", create);', "// rb:handler errors.unmatched", "app.use(notFound);"]);
  assert.deepEqual(req(resolve({ target: "x:y", language: "node", files: [marked], endpoints, noHandler }).found), [
    "x:y declares no handler for errors.unmatched and marks one (app.js:3)",
  ]);
});

test("every assertion a framework fails is a problem, naming the first few subjects", () => {
  const failed: Failures = { not_only_annotations: ["a", "b", "c", "d", "e"], mentions_dep: [], no_test: ["x"], names_endpoint: [] };
  assert.deepEqual(failing("x:y", failed), ["x:y fails no_test on 1: x", "x:y fails not_only_annotations on 5: a, b, c, d, …"]);
  assert.deepEqual(failing("x:y", { not_only_annotations: [], mentions_dep: [], no_test: [], names_endpoint: [] }), []);
});
