// Where each endpoint is answered, per framework, as a path and a line range with the hash of
// the file it came from. A port of upstream's harness/snippets.py at 9939f4c, rule for rule;
// orchestrator/test/snippets-parity.ts holds the two to the same answer on upstream's targets.
//
// A published number names a framework and an endpoint, and a reader wants the handful of lines
// that produced it next. This derives that pointer rather than asking every framework to declare
// one, because a declaration goes stale silently and a derivation is checked on every run.
//
// Two ways in, in this order:
//   marked   `rb:<kind> <selector>[,<selector>...]`, closed by `rb:end` where needed. The kinds
//            are in marks.ts.
//   derived  With no mark, the endpoint's route is looked for as a string literal, whatever
//            capture syntax the framework spells a parameter with. Gin writes /items/:id where the
//            corpus writes /items/{draw.item}, and both have to land on the same line.
//
// Nothing is stored and nothing here reads the repository. The caller hands over the files, the
// endpoints and what rb.json declares, at whatever commit it is describing.
//
// Two location checks, both from upstream: a route matching in more than one place is a problem
// rather than a first match, because first-match is how a comment or a test gets rendered as the
// implementation; and a derived snippet must contain the route it claims. The assertions in
// marks.ts ask what is in a snippet, counted against the allowance.
import { ASSERTIONS, KINDS, type AssertionName, type Kind, type KindName } from "./marks.ts";

export interface Endpoint {
  readonly id: string;
  readonly family: string;
  readonly method: string;
  /** A `{...}` segment is a capture, and a `?query` is ignored. */
  readonly path: string;
  /** The endpoint this one is read against. An endpoint with no route of its own may be an instance of its base's. */
  readonly base?: string | undefined;
}

export interface SourceFile {
  readonly path: string;
  readonly text: string;
  readonly hash: string;
  /** The file's bundle role, which decides which kinds may read it. */
  readonly role: string;
}

/** What rb.json declares one family is wired with. */
export interface Mechanism {
  readonly mechanism?: string | undefined;
  readonly dependency?: string | undefined;
  /** The token the support has to contain, where the code spells the dependency differently. */
  readonly mentions?: string | undefined;
  /** Why there is nothing to show. */
  readonly builtin?: string | undefined;
}

/** A block the part sits inside, which travels beside the range rather than in it. */
export interface Context {
  readonly line: number;
  readonly text: string;
}

export interface Part {
  readonly path: string;
  /** One-based and inclusive. */
  readonly startLine: number;
  readonly endLine: number;
  readonly hash: string;
  readonly how: "derived" | "marker";
  readonly text: string;
  context: Context[];
  scope?: "endpoint" | "family" | "target";
  keys?: Record<string, string>;
}

export interface SnippetRecord {
  readonly endpoint: string;
  readonly target: string;
  handler: Part | null;
  support: Part[];
  test: Part[];
}

export type Failures = Record<AssertionName, string[]>;

/** Counts per framework per assertion, as orchestrator/allowance.json holds them. */
export type Allowance = Readonly<Record<string, Readonly<Partial<Record<AssertionName, number>>>>>;

// ---- Python's text rules --------------------------------------------------------------------

/**
 * The characters Python's str.isspace() and its re module's \s accept. JavaScript's \s differs:
 * it takes a byte order mark and leaves out \x1c to \x1f and \x85, and a .NET source file often
 * starts with a byte order mark.
 */
const WS = "\\t\\n\\x0b\\x0c\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const LEADING = new RegExp(`^[${WS}]+`);
const TRAILING = new RegExp(`[${WS}]+$`);
const lstrip = (s: string): string => s.replace(LEADING, "");
const rstrip = (s: string): string => s.replace(TRAILING, "");
const strip = (s: string): string => rstrip(lstrip(s));

const LINE_BREAK = new RegExp("\\r\\n|[\\n\\r\\x0b\\x0c\\x1c\\x1d\\x1e\\x85\\u2028\\u2029]");

/** Python's str.splitlines(): a trailing break ends the last line rather than starting an empty one. */
export function splitLines(text: string): string[] {
  const out = text.split(LINE_BREAK);
  if (out[out.length - 1] === "") out.pop();
  return out;
}

/** Python's re.escape. */
const escapeRe = (s: string): string => s.replace(/[()[\]{}?*+\-|^$\\.&~# \t\n\r\v\f]/g, "\\$&");

// ---- routes ---------------------------------------------------------------------------------

/**
 * How frameworks spell a route parameter. The name is never matched, only the shape. A
 * converter is part of the shape, so the colon is inside the brackets: Litestar writes
 * {oid:str} and Django writes <int:pk>.
 */
const CAPTURE = "(?::[\\w]+|\\{[\\w.*:]*\\}|<[\\w:]+>|\\*[\\w]*)";
/** A route literal is delimited, which keeps /items/{id} from matching inside "/items/{id}/summary". */
const QUOTE = "[\"'`]";
/** Rocket writes #[get("/query/one?<q..>")]. The route is the part before the ?, so the tail is matched and ignored. */
const QUERY_SPEC = "(?:\\?[^\"'`]*)?";

const METHODS = ["get", "post", "put", "patch", "delete"] as const;

/** Anchored at the start of the comment, so prose that mentions a mark is not read as one. */
const MARK = new RegExp(`^[${WS}/*#<!-]*rb:([a-z]+)\\b[ \\t]*(.*?)[ \\t]*(?:\\*/|-->)?[ \\t]*$`);
const MARK_END = new RegExp(`^[${WS}/*#<!-]*rb:end\\b`);

const OPEN = "([{";
const CLOSE = ")]}";

/** An annotation, an attribute, or a comment. None of them is a handler. */
const ANNOTATION = new RegExp(`^[${WS}]*(?:@|#\\[|\\[[A-Za-z])`);
const COMMENT = new RegExp(`^[${WS}]*(?://|/\\*|\\*|#(?!\\[))`);

/** Languages where ' opens a character literal rather than a string. Rust spells a lifetime with the same tick. */
const CHAR_QUOTE = new Set(["go", "java", "dotnet", "rust"]);

/**
 * A file's own punctuation where it has one. A .yaml beside a Java framework has no semicolons
 * and no braces, and reading it with Java's rules runs a mark from a key to the end of the file.
 */
const DATA = [".yaml", ".yml", ".json", ".toml", ".properties", ".ini", ".conf"];

/**
 * Languages where a statement ends at a semicolon, so a balanced line that has not reached one
 * continues on the next. Vert.x writes `router.get("/x")` on one line and `.handler(...)` on the
 * next.
 */
const SEMICOLON = new Set(["java", "dotnet"]);

const syntaxOf = (path: string, language: string): string => (DATA.some((s) => path.endsWith(s)) ? "data" : language);

/** The path a router would be given: no query string, no fragment. */
const routeOf = (ep: Endpoint): string => ep.path.split("?")[0]!;

const routeRegexes = new Map<string, RegExp>();

function routeRegex(route: string): RegExp {
  let rx = routeRegexes.get(route);
  if (rx === undefined) {
    const segments = route
      .split("/")
      .slice(1)
      .map((seg) => (seg.startsWith("{") && seg.endsWith("}") ? CAPTURE : escapeRe(seg)));
    // The leading slash is optional, because Django's path() matches what is left after the
    // slash. The quotes still delimit.
    rx = new RegExp(`${QUOTE}/?${segments.join("/")}${QUERY_SPEC}${QUOTE}`);
    routeRegexes.set(route, rx);
  }
  return rx;
}

const instanceRegexes = new Map<string, RegExp>();

/**
 * The route as a matcher for concrete URLs, so /items/999999 is recognised as an instance of
 * /items/{id} and is therefore answered by it. /compressed/small is not one of /json/small.
 */
function instanceRegex(route: string): RegExp {
  let rx = instanceRegexes.get(route);
  if (rx === undefined) {
    const pattern = route
      .split("/")
      .map((seg) => (seg.startsWith("{") && seg.endsWith("}") ? "[^/]+" : escapeRe(seg)))
      .join("/");
    rx = new RegExp(`^(?:${pattern})$`);
    instanceRegexes.set(route, rx);
  }
  return rx;
}

// ---- reading source ---------------------------------------------------------------------

/** Whether the # at `i` opens a Rust attribute rather than a comment. */
const attribute = (line: string, i: number): boolean => i + 1 < line.length && "[!".includes(line[i + 1]!);

/**
 * Whether the ' at `i` opens a character literal rather than a lifetime. Rust spells both with
 * the same tick, and reading `&'static` as an open quote blanks the rest of the line, brace and
 * all.
 */
function charLiteral(line: string, i: number): boolean {
  if (i + 1 >= line.length) return false;
  if (line[i + 1] === "\\") return line.slice(i + 2, i + 12).includes("'");
  return i + 2 < line.length && line[i + 2] === "'";
}

/**
 * The line with string bodies and line comments blanked, for counting delimiters. A route can
 * hold a brace, and a comment can hold an unbalanced one.
 */
function stripCode(line: string, syntax: string): string {
  let out = "";
  let i = 0;
  let quote: string | null = null;
  while (i < line.length) {
    const c = line[i]!;
    if (quote !== null) {
      if (c === "\\") {
        out += "  ";
        i += 2;
        continue;
      }
      out += " ";
      if (c === quote) quote = null;
      i += 1;
      continue;
    }
    if (c === "'" && CHAR_QUOTE.has(syntax) && !charLiteral(line, i)) {
      out += c;
      i += 1;
      continue;
    }
    if ("\"'`".includes(c)) {
      quote = c;
      out += " ";
      i += 1;
      continue;
    }
    if (line.startsWith("//", i) || (line.startsWith("#", i) && !attribute(line, i))) break;
    out += c;
    i += 1;
  }
  return out;
}

function endsStatement(line: string, syntax: string): boolean {
  if (!SEMICOLON.has(syntax)) return true;
  const text = rstrip(stripCode(line, syntax));
  return text === "" || ";{}:".includes(text[text.length - 1]!);
}

/**
 * The last line of the delimited block opening on `start`. A line that opens nothing is its own
 * block, which is what a bare annotation or a one-line declaration needs.
 */
function blockEnd(lines: readonly string[], start: number, syntax: string): number {
  let depth = 0;
  let opened = false;
  for (let n = start; n < Math.min(lines.length, start + 80); n++) {
    for (const c of stripCode(lines[n]!, syntax)) {
      if (OPEN.includes(c)) {
        depth += 1;
        opened = true;
      } else if (CLOSE.includes(c)) {
        depth -= 1;
      }
    }
    if (opened && depth <= 0 && endsStatement(lines[n]!, syntax)) return n;
    // `var x string` opens nothing and is complete. A C# class header opens nothing and is not,
    // which is what the statement rule separates.
    if (!opened && endsStatement(lines[n]!, syntax)) return start;
  }
  return start;
}

const indentOf = (line: string): number => line.length - lstrip(line).length;

/** Whether the line leaves a delimiter open. A route registration does; a switch case label does not. */
function opensBlock(line: string, syntax: string): boolean {
  let depth = 0;
  for (const c of stripCode(line, syntax)) depth += OPEN.includes(c) ? 1 : CLOSE.includes(c) ? -1 : 0;
  return depth > 0;
}

/**
 * The last line of the indentation block opening on `start`: what a delimiter count cannot
 * answer, for a Python `async def` or a case label.
 */
function dedentEnd(lines: readonly string[], start: number): number {
  const base = indentOf(lines[start]!);
  let end = start;
  for (let n = start + 1; n < lines.length; n++) {
    if (strip(lines[n]!) !== "" && indentOf(lines[n]!) <= base) break;
    end = n;
  }
  while (end > start && strip(lines[end]!) === "") end -= 1;
  return end;
}

/**
 * The last line of a block a mark labels. A registration ends by the balanced rule; a case label
 * opens nothing and runs until the source dedents back to it; a C# signature balances its
 * parentheses and opens its body on the next line, so it needs the statement rule too.
 */
function markedEnd(lines: readonly string[], start: number, syntax: string): number {
  if (opensBlock(lines[start]!, syntax) || !endsStatement(lines[start]!, syntax)) return blockEnd(lines, start, syntax);
  return dedentEnd(lines, start);
}

/** Whether these lines hold nothing but annotations, attributes and comments. */
function annotationRun(lines: readonly string[], start: number, end: number): boolean {
  return lines.slice(start, end + 1).every((l) => {
    const s = strip(l);
    return s === "" || COMMENT.test(s) || ANNOTATION.test(s);
  });
}

/** Where the declaration on `start` ends. A decorated Python `async def` is an indentation block. */
function declarationEnd(lines: readonly string[], start: number, syntax: string): number {
  return syntax === "python" ? dedentEnd(lines, start) : markedEnd(lines, start, syntax);
}

/**
 * Extend a block that turned out to be only annotations onto what it annotates. An annotation
 * balances its own parentheses, so it is a complete block, and without this the declaration
 * under it is never read.
 */
function throughAnnotations(lines: readonly string[], start: number, end: number, syntax: string): number {
  if (!annotationRun(lines, start, end)) return end;
  for (let n = end + 1; n < lines.length; n++) {
    const s = strip(lines[n]!);
    if (s === "" || COMMENT.test(s) || ANNOTATION.test(s)) continue;
    return Math.max(end, declarationEnd(lines, n, syntax));
  }
  return end;
}

/**
 * The open blocks this line sits inside, outermost first. They travel beside a part that does not
 * name its route, as context, because the range has to stay the lines that serve the endpoint.
 * Scanned forwards with a stack, because `} else if (x) {` closes one block and opens another,
 * and an indentation walk steps over it into the sibling branch.
 */
function enclosing(lines: readonly string[], start: number, syntax: string): Context[] {
  const stack: number[] = [];
  for (let n = 0; n < start; n++) {
    for (const c of stripCode(lines[n]!, syntax)) {
      if (OPEN.includes(c)) stack.push(n);
      else if (CLOSE.includes(c) && stack.length > 0) stack.pop();
    }
  }
  const out: Context[] = [];
  const seen = new Set<number>();
  for (const n of stack) {
    // One line can open two frames, a call and an arrow body. It is one line of context.
    if (!seen.has(n) && strip(lines[n]!) !== "") {
      seen.add(n);
      out.push({ line: n + 1, text: rstrip(lines[n]!) });
    }
  }
  return out;
}

/** Walk back over the annotations above a declaration. Java writes the route on one and the handler under it. */
function annotatedStart(lines: readonly string[], line: number): number {
  let n = line;
  while (n > 0) {
    const prev = strip(lines[n - 1]!);
    if (prev.startsWith("@") && !prev.startsWith("@@")) n -= 1;
    else break;
  }
  return n;
}

const METHOD_WORD = new Map(METHODS.map((m) => [m, new RegExp(`(?:^|[^A-Za-z])${m}(?:$|[^A-Za-z])`, "i")]));
/** .NET runs the method into the name: MapGet, MapPost, WolverineDelete. */
const METHOD_HUMP = new Map(METHODS.map((m) => [m, new RegExp(`[a-z]${m[0]!.toUpperCase()}${m.slice(1)}(?:$|[^a-z])`)]));
const METHOD_MAPPING = new Map(METHODS.map((m) => [m, new RegExp(`@${m}Mapping`, "i")]));
const METHOD_CALL = new Map(METHODS.map((m) => [m, new RegExp(`(?:^|[^A-Za-z])${m}[${WS}]*\\(`, "i")]));
const QUOTED = new RegExp(`${QUOTE}[^"'\`]*${QUOTE}`, "g");

/**
 * The HTTP method a route registration on this line names, if it names one, read from the line
 * rather than from the framework's API, so `app.post(`, `r.POST(`, `MapPost` and `@GetMapping`
 * all answer the same way.
 */
function methodOn(lines: readonly string[], line: number, syntax: string): string | null {
  const text = stripCode(lines[line]!, syntax);
  const head = text.split("(")[0]!;
  for (const m of METHODS) {
    if (METHOD_WORD.get(m)!.test(head)) return m;
    if (METHOD_HUMP.get(m)!.test(head)) return m;
    if (METHOD_MAPPING.get(m)!.test(lines[line]!)) return m;
  }
  // actix writes the method after the path, `.route("/x", web::get().to(h))`. Only when the line
  // names exactly one: axum registers `get(lookup).put(replace)` on one line, and answering "get"
  // there would hide the PUT.
  const outside = text.replace(QUOTED, "");
  const seen = METHODS.filter((m) => METHOD_CALL.get(m)!.test(outside));
  return seen.length === 1 ? seen[0]! : null;
}

const textOf = (lines: readonly string[], start: number, end: number): string => lines.slice(start, end + 1).join("\n");

/** Where a line comment starts, or the length of the line. Quote-aware, so a `//` in a route does not truncate it. */
function commentAt(line: string, syntax: string): number {
  let i = 0;
  let quote: string | null = null;
  while (i < line.length) {
    const c = line[i]!;
    if (quote !== null) {
      i += c === "\\" ? 2 : 1;
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" && CHAR_QUOTE.has(syntax) && !charLiteral(line, i)) {
      i += 1;
      continue;
    }
    if ("\"'`".includes(c)) {
      quote = c;
    } else if (line.startsWith("//", i)) {
      return i;
    } else if (line.startsWith("#", i)) {
      if (attribute(line, i)) {
        i += 1;
        continue;
      }
      return i;
    }
    i += 1;
  }
  return line.length;
}

/** Every place this endpoint's route is registered, as [start, end] line indexes. */
function derive(lines: readonly string[], ep: Endpoint, syntax: string): [number, number][] {
  const rx = routeRegex(routeOf(ep));
  const method = ep.method.toLowerCase();
  const hits: [number, number][] = [];
  lines.forEach((line, n) => {
    const m = rx.exec(line);
    // A route literal also turns up in the prose above a neighbouring route, and counting it
    // would make a correct file ambiguous.
    if (m === null || m.index >= commentAt(line, syntax)) return;
    const found = methodOn(lines, n, syntax);
    if (found !== null && found !== method) return;
    const start = annotatedStart(lines, n);
    // A data file has no delimiters to balance: an OpenAPI path is a key, and what it serves is
    // the block indented under it.
    const end = syntax === "data" ? dedentEnd(lines, n) : blockEnd(lines, n, syntax);
    hits.push([start, throughAnnotations(lines, start, end, syntax)]);
  });
  return hits;
}

// ---- marks ------------------------------------------------------------------------------

interface Corpus {
  readonly endpoints: readonly Endpoint[];
  readonly byId: ReadonlyMap<string, Endpoint>;
  /** In the order the endpoints first name them. A family is what wiring is keyed by. */
  readonly families: readonly string[];
}

function corpusOf(endpoints: readonly Endpoint[]): Corpus {
  return {
    endpoints,
    byId: new Map(endpoints.map((e) => [e.id, e])),
    families: [...new Set(endpoints.map((e) => e.family))],
  };
}

/** The kind a mark line names, or null. `rb:end` is read as the kind "end". */
function markOn(line: string): string | null {
  return MARK.exec(line)?.[1] ?? null;
}

/**
 * The endpoints or families a selector names, or nothing. `.*` rather than a bare family name,
 * because a bare name is ambiguous the first time a family and an endpoint share one.
 */
function expand(selector: string, selects: Kind["selects"], c: Corpus): string[] {
  const dot = selector.indexOf(".");
  const family = dot < 0 ? selector : selector.slice(0, dot);
  const rest = dot < 0 ? "" : selector.slice(dot + 1);
  if (selects === "family") {
    if (selector === "*") return [...c.families];
    return rest === "*" && c.families.includes(family) ? [family] : [];
  }
  if (selector === "*") return c.endpoints.map((e) => e.id);
  if (rest === "*") return c.endpoints.filter((e) => e.family === family).map((e) => e.id);
  return c.byId.has(selector) ? [selector] : [];
}

interface Mark {
  readonly kind: KindName;
  readonly subjects: string[];
  readonly keys: Record<string, string>;
  readonly scope: "endpoint" | "family" | "target";
  readonly start: number;
  readonly end: number;
  readonly line: number;
}

/**
 * Every mark in the file, and one complaint per mark that names nothing. A mark labels the block
 * under it and runs to that block's end, or to an `rb:end` where the block rule would stop short.
 * Several marks stacked on one block all label it.
 */
function marks(lines: readonly string[], syntax: string, c: Corpus): { found: Mark[]; bad: [string, number][] } {
  const found: Mark[] = [];
  const bad: [string, number][] = [];
  lines.forEach((line, n) => {
    const m = MARK.exec(line);
    if (m === null) return;
    const kind = m[1]!;
    if (kind === "end") return;
    if (!Object.hasOwn(KINDS, kind)) {
      bad.push([`rb:${kind} is not a kind in orchestrator/marks.ts`, n]);
      return;
    }
    const spec = KINDS[kind as KindName];
    const selectors: string[] = [];
    const keys: Record<string, string> = {};
    for (const token of strip(m[2]!).split(new RegExp(`[,${WS}]+`))) {
      if (token === "") continue;
      const eq = token.indexOf("=");
      if (eq >= 0) keys[token.slice(0, eq)] = token.slice(eq + 1);
      else selectors.push(token);
    }
    const subjects: string[] = [];
    for (const selector of selectors) {
      const named = expand(selector, spec.selects, c);
      if (named.length === 0) bad.push([`rb:${kind} ${selector} names no ${spec.selects}`, n]);
      subjects.push(...named);
    }
    // How widely the mark selects, which is not how many subjects it names. A helper marked for a
    // family serves that family's tests and is not one of them.
    const scope = selectors.includes("*") ? "target" : selectors.some((s) => s.endsWith(".*")) ? "family" : "endpoint";
    if (subjects.length === 0) return;
    let start = n + 1;
    while (start < lines.length && (strip(lines[start]!) === "" || markOn(lines[start]!) !== null)) start += 1;
    if (start >= lines.length) return;
    let end = throughAnnotations(lines, start, markedEnd(lines, start, syntax), syntax);
    let closed: number | null = null;
    let opened: number | null = null;
    for (let k = start; k < lines.length; k++) {
      if (closed === null && MARK_END.test(lines[k]!)) closed = k;
      const other = markOn(lines[k]!);
      if (opened === null && other !== null && other !== "end") opened = k;
      if (closed !== null && opened !== null) break;
    }
    // An explicit end wins: it is written where the block rule would not have reached.
    if (closed !== null && (opened === null || closed < opened)) end = closed - 1;
    found.push({ kind: kind as KindName, subjects, keys, scope, start, end, line: n });
  });
  return { found, bad };
}

function part(path: string, hash: string, lines: readonly string[], start: number, end: number, how: Part["how"], context: Context[] = []): Part {
  return { path, startLine: start + 1, endLine: end + 1, hash, how, text: textOf(lines, start, end), context: [...context] };
}

// ---- resolving ----------------------------------------------------------------------------

interface Loaded {
  readonly lines: string[];
  readonly hash: string;
  readonly role: string;
}

/**
 * Every place this endpoint's route is registered, as parts. Derivation is the way in wherever
 * the route literal sits on the declaration, which is most of any corpus.
 */
function derived(language: string, files: ReadonlyMap<string, Loaded>, roles: readonly string[], ep: Endpoint): Part[] {
  const hits: Part[] = [];
  for (const [path, file] of files) {
    if (!roles.includes(file.role)) continue;
    for (const [start, end] of derive(file.lines, ep, syntaxOf(path, language))) {
      const body = textOf(file.lines, start, end);
      // A snippet that writes its own route needs nothing more. One that does not is a fragment
      // of a dispatch, and the blocks around it are what make it a handler. Upstream reads them
      // with the framework's language here and with the file's own syntax in resolve(); the port
      // keeps both.
      const context = routeRegex(routeOf(ep)).test(body) ? [] : enclosing(file.lines, start, language);
      hits.push(part(path, file.hash, file.lines, start, end, "derived", context));
    }
  }
  return hits;
}

const compareSpan = (a: readonly [string, number, number], b: readonly [string, number, number]): number =>
  a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1] || a[2] - b[2];

/**
 * One record per endpoint this framework answers, and one complaint per problem. Support parts
 * come from other files than the handler, so each part carries its own path, range and hash.
 * They are keyed by family, because six compressed.* endpoints share one gzip.
 */
export function resolve(input: {
  readonly target: string;
  readonly language: string;
  readonly files: readonly SourceFile[];
  readonly endpoints: readonly Endpoint[];
}): { found: Record<string, SnippetRecord>; problems: string[] } {
  const { target, language } = input;
  const c = corpusOf(input.endpoints);
  const readable = new Set(Object.values(KINDS).flatMap((k) => k.roles));
  const files = new Map<string, Loaded>();
  for (const f of input.files) {
    if (readable.has(f.role)) files.set(f.path, { lines: splitLines(f.text), hash: f.hash, role: f.role });
  }

  const kinds = Object.entries(KINDS) as [KindName, Kind][];
  const claimed = new Map<KindName, Map<string, Part[]>>(kinds.map(([k]) => [k, new Map()]));
  const problems: string[] = [];
  for (const [path, file] of files) {
    const { found, bad } = marks(file.lines, syntaxOf(path, language), c);
    for (const [why, n] of bad) problems.push(`${target} ${why} (${path}:${n + 1})`);
    for (const mk of found) {
      const spec = KINDS[mk.kind];
      if (!spec.roles.includes(file.role)) {
        problems.push(`${target} rb:${mk.kind} reads ${spec.roles.join("/")} files and this one is ${file.role} (${path}:${mk.line + 1})`);
        continue;
      }
      const got = part(path, file.hash, file.lines, mk.start, mk.end, "marker");
      got.scope = mk.scope;
      if (Object.keys(mk.keys).length > 0) got.keys = mk.keys;
      const into = claimed.get(mk.kind)!;
      for (const subject of mk.subjects) {
        const list = into.get(subject);
        if (list === undefined) into.set(subject, [got]);
        else list.push(got);
      }
    }
  }

  const out = new Map<string, SnippetRecord>();
  for (const [kind, spec] of kinds) {
    if (spec.selects !== "endpoint") continue;
    for (const ep of c.endpoints) {
      let hits = [...(claimed.get(kind)!.get(ep.id) ?? [])];
      let via = routeOf(ep);
      if (hits.length === 0 && spec.derive) hits = derived(language, files, spec.roles, ep);
      // An endpoint with no route of its own is served by the parameterised route it is an
      // instance of: /items/999999 is answered by /items/{id}. Only an instance qualifies, because
      // `base` is otherwise a comparison and not an alias.
      if (hits.length === 0 && spec.derive && ep.base !== undefined && c.byId.has(ep.base)) {
        const base = c.byId.get(ep.base)!;
        const baseRoute = routeOf(base);
        if (baseRoute !== via && instanceRegex(baseRoute).test(via)) {
          via = baseRoute;
          hits = derived(language, files, spec.roles, base);
        }
      }
      if (hits.length === 0) continue;
      const spans = new Map<string, [string, number, number]>();
      for (const h of hits) spans.set(`${h.path}\0${h.startLine}\0${h.endLine}`, [h.path, h.startLine, h.endLine]);
      if (spec.cardinality === "one" && spans.size > 1) {
        const where = [...spans.values()].sort(compareSpan).map(([p, s]) => `${p}:${s}`).join(", ");
        problems.push(`${target} ${ep.id} matches in ${spans.size} places: ${where}`);
        continue;
      }
      const got = hits[0]!;
      const namesRoute = routeRegex(via).test(got.text);
      if (!namesRoute && got.context.length === 0) {
        got.context = enclosing(files.get(got.path)!.lines, got.startLine - 1, syntaxOf(got.path, language));
      }
      // Kept from upstream. A derived part always holds the line its route matched on, so this
      // only fires if the matching and the expansion stop agreeing.
      if (got.how === "derived" && !namesRoute) {
        problems.push(`${target} ${ep.id} expanded past its own route (${got.path}:${got.startLine}-${got.endLine})`);
        continue;
      }
      let rec = out.get(ep.id);
      if (rec === undefined) {
        rec = { endpoint: ep.id, target, handler: null, support: [], test: [] };
        out.set(ep.id, rec);
      }
      if (spec.into === "handler") rec.handler = got;
      else rec[spec.into] = hits;
    }
  }

  // Family-keyed kinds hang off every endpoint of the family, because the page is per endpoint
  // and the relation is per family.
  for (const [kind, spec] of kinds) {
    if (spec.selects === "endpoint") continue;
    for (const [eid, rec] of out) {
      const parts = [...(claimed.get(kind)!.get(c.byId.get(eid)!.family) ?? [])];
      if (spec.into === "handler") rec.handler = parts[0] ?? null;
      else rec[spec.into] = parts;
    }
  }

  // A record with no handler is not a located endpoint, whatever else claimed it.
  let located = [...out];
  for (const [, spec] of kinds) {
    if (spec.required !== "every") continue;
    located = located.filter(([, rec]) => (spec.into === "handler" ? rec.handler !== null : rec[spec.into].length > 0));
  }
  return { found: Object.fromEntries(located), problems };
}

// ---- what a snippet holds -------------------------------------------------------------------

/** Whether a snippet is nothing but annotations, attributes and comments. */
export function onlyAnnotations(text: string): boolean {
  for (const line of splitLines(text)) {
    const s = strip(line);
    if (s !== "" && !COMMENT.test(s) && !ANNOTATION.test(s)) return false;
  }
  return true;
}

/** The token a family's support has to contain: `mentions` where given, else the dependency itself. */
const mentioned = (decl: Mechanism): string => decl.mentions ?? decl.dependency ?? "";

/** The test parts marked for this endpoint by name, without the helpers serving it. */
const ownTests = (rec: SnippetRecord): Part[] => rec.test.filter((p) => (p.scope ?? "endpoint") === "endpoint");

/** The support parts each family produced. */
function supporting(found: Readonly<Record<string, SnippetRecord>>, byId: ReadonlyMap<string, Endpoint>): Map<string, Part[]> {
  const out = new Map<string, Part[]>();
  for (const [eid, rec] of Object.entries(found)) {
    const family = byId.get(eid)!.family;
    if (!out.has(family)) out.set(family, rec.support);
  }
  return out;
}

const RECORD_ASSERT: Readonly<Record<Exclude<AssertionName, "mentions_dep">, (rec: SnippetRecord) => boolean>> = {
  not_only_annotations: (rec) => rec.handler !== null && onlyAnnotations(rec.handler.text),
  // Coverage rather than a claim about a snippet, riding the allowance because that is the
  // machinery a count that only goes down already has.
  no_test: (rec) => ownTests(rec).length === 0,
  // Silent where there is no test at all, because no_test counts that.
  names_endpoint: (rec) => {
    const own = ownTests(rec);
    return own.length > 0 && !own.every((p) => p.text.includes(rec.endpoint));
  },
};

const FAMILY_ASSERT: Readonly<Record<"mentions_dep", (parts: readonly Part[], decl: Mechanism) => boolean>> = {
  mentions_dep: (parts, decl) => !parts.map((p) => p.text).join("\n").includes(mentioned(decl)),
};

/**
 * Which subjects fail each assertion. Counted rather than fatal: what they measure can be most of
 * a framework at first, and a gate that went red on it would block every branch fixing it.
 */
export function assess(input: {
  readonly found: Readonly<Record<string, SnippetRecord>>;
  readonly endpoints: readonly Endpoint[];
  readonly mechanisms: Readonly<Record<string, Mechanism>>;
}): Failures {
  const c = corpusOf(input.endpoints);
  const out = Object.fromEntries(Object.keys(ASSERTIONS).map((name) => [name, [] as string[]])) as Failures;
  for (const eid of Object.keys(input.found).sort()) {
    const rec = input.found[eid]!;
    for (const [name, test] of Object.entries(RECORD_ASSERT) as [keyof typeof RECORD_ASSERT, (r: SnippetRecord) => boolean][]) {
      if (!ASSERTIONS[name].except.includes(eid) && test(rec)) out[name].push(eid);
    }
  }
  const support = supporting(input.found, c.byId);
  for (const family of [...support.keys()].sort()) {
    const decl = input.mechanisms[family] ?? {};
    if (decl.mechanism === undefined) continue;
    for (const [name, test] of Object.entries(FAMILY_ASSERT) as ["mentions_dep", (p: readonly Part[], d: Mechanism) => boolean][]) {
      if (!ASSERTIONS[name].except.includes(family) && test(support.get(family)!, decl)) out[name].push(family);
    }
  }
  return out;
}

/**
 * What each kind requires of this framework, as one complaint per shortfall. "every" is the
 * coverage gate over the endpoints the framework has to answer. "declared" reads rb.json, which is
 * where absence has to live: a family wired with nothing has no file to hold a mark, and without
 * the declaration a missing mark renders an empty section that nothing notices.
 */
export function requirements(input: {
  readonly target: string;
  readonly found: Readonly<Record<string, SnippetRecord>>;
  readonly endpoints: readonly Endpoint[];
  /** The endpoints that must locate a handler. */
  readonly required: ReadonlySet<string>;
  readonly mechanisms: Readonly<Record<string, Mechanism>>;
  /** Every manifest-role file in the bundle, concatenated. */
  readonly manifestText: string;
}): string[] {
  const { target, found, mechanisms } = input;
  const c = corpusOf(input.endpoints);
  const support = supporting(found, c.byId);
  const out: string[] = [];
  for (const [kind, spec] of Object.entries(KINDS) as [KindName, Kind][]) {
    // Upstream also held a family with marked tests to a declared suite facility. That
    // declaration is not part of rb.json yet, so a ratchet kind owes nothing here.
    if (spec.required === "ratchet") continue;
    if (spec.required === "every") {
      const required = c.endpoints.filter((e) => input.required.has(e.id));
      const missing = required.filter((e) => {
        const rec = found[e.id];
        return rec === undefined || (spec.into === "handler" ? rec.handler === null : rec[spec.into].length === 0);
      });
      if (missing.length > 0) {
        out.push(`${target} is conformance-required and locates a ${kind} for only ${required.length - missing.length}/${required.length} endpoints`);
      }
    }
    if (spec.required !== "declared") continue;
    for (const family of c.families) {
      const decl = mechanisms[family];
      if (decl === undefined || Object.keys(decl).length === 0) {
        out.push(`${target} declares no mechanism for ${family} in rb.json`);
      } else if (decl.mechanism !== undefined) {
        if ((support.get(family) ?? []).length === 0) out.push(`${target} declares ${decl.mechanism} for ${family} and marks no ${kind} for it`);
        if (decl.dependency && !input.manifestText.includes(decl.dependency)) {
          out.push(`${target} declares ${decl.dependency} for ${family} and no manifest names it`);
        }
      } else if (decl.builtin !== undefined) {
        // The declaration says there is nothing to show, so a part contradicts it.
        const parts = support.get(family) ?? [];
        if (parts.length > 0) out.push(`${target} declares ${family} built in and marks ${parts.length} ${kind} part(s) for it`);
      } else {
        out.push(`${target} declares neither a mechanism nor builtin for ${family}`);
      }
    }
  }
  return out;
}

/** How many families this framework accounts for, and how. */
export function covered(families: readonly string[], mechanisms: Readonly<Record<string, Mechanism>>): { wired: number; builtin: number } {
  return {
    wired: families.filter((f) => mechanisms[f]?.mechanism !== undefined).length,
    builtin: families.filter((f) => mechanisms[f]?.builtin !== undefined).length,
  };
}

// ---- the allowance ----------------------------------------------------------------------------

/** The failures as counts, leaving out assertions nothing fails. */
export function countsOf(failed: Failures): Partial<Record<AssertionName, number>> {
  const out: Partial<Record<AssertionName, number>> = {};
  for (const [name, subjects] of Object.entries(failed) as [AssertionName, string[]][]) if (subjects.length > 0) out[name] = subjects.length;
  return out;
}

/** One problem per assertion this framework fails more often than its allowance lets it. */
export function overAllowance(target: string, failed: Failures, allowed: Readonly<Partial<Record<AssertionName, number>>>): string[] {
  const counts = countsOf(failed);
  const names = [...new Set([...Object.keys(counts), ...Object.keys(allowed)])].sort() as AssertionName[];
  const out: string[] = [];
  for (const name of names) {
    const n = counts[name] ?? 0;
    const was = allowed[name] ?? 0;
    if (n > was) {
      const shown = failed[name].slice(0, 4).join(", ") + (n > 4 ? ", …" : "");
      out.push(`${target} fails ${name} on ${n} endpoints, ${was} allowed: ${shown}`);
    }
  }
  return out;
}

/** One line per assertion now failing less often than allowed, which the allowance should be lowered to. */
export function belowAllowance(failed: Failures, allowed: Readonly<Partial<Record<AssertionName, number>>>): string[] {
  const counts = countsOf(failed);
  return (Object.keys(allowed).sort() as AssertionName[])
    .filter((name) => (counts[name] ?? 0) < allowed[name]!)
    .map((name) => `${name} is down to ${counts[name] ?? 0} from an allowance of ${allowed[name]}: run --ratchet`);
}

/**
 * The allowance rewritten from what every framework does now. It is only ever lowered in
 * practice, because the check fails on anything above it, so a count can only rise by someone
 * running this on purpose and a reviewer reading the diff.
 */
export function ratchet(measured: Readonly<Record<string, Failures>>): Allowance {
  const out: Record<string, Partial<Record<AssertionName, number>>> = {};
  for (const target of Object.keys(measured).sort()) {
    const counts = countsOf(measured[target]!);
    const names = Object.keys(counts).sort() as AssertionName[];
    if (names.length > 0) out[target] = Object.fromEntries(names.map((n) => [n, counts[n]!]));
  }
  return out;
}

/** The record without its source: where every part is, and nothing of what it says. */
export function located(rec: SnippetRecord): unknown {
  const where = (p: Part) => {
    const { text: _text, ...rest } = p;
    return rest;
  };
  return { ...rec, handler: rec.handler === null ? null : where(rec.handler), support: rec.support.map(where), test: rec.test.map(where) };
}
