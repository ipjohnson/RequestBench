// What a mark may claim, and what has to be true of what it captured. Upstream kept this in
// spec/marks.json; here it is typed, so a kind or an assertion that snippets.ts does not know
// is a compile error rather than a KeyError at run time.
//
// A mark is `rb:<kind> <selector>[,<selector>...] [<key>=<value>...]`, closed by `rb:end` where
// the block rule would stop short of what the author meant. A selector is `family.endpoint` for
// one, `family.*` for all of a family, or `*` for the framework. snippets.ts never learns a
// kind's name, so adding one is an entry here and a section on the page.
//
// A kind is required "every" (a framework has to locate one for each required endpoint),
// "declared" (rb.json says per family whether there is anything to show), "asserted" (an
// assertion asks for it, so a record without one is kept and reported) or "never". Every
// assertion a framework fails is a problem `rb check` reports.

export type KindName = "handler" | "wiring" | "test";
export type AssertionName = "not_only_annotations" | "mentions_dep" | "no_test" | "names_endpoint";

export interface Kind {
  readonly what: string;
  readonly selects: "endpoint" | "family";
  readonly required: "every" | "declared" | "asserted" | "never";
  readonly cardinality: "one" | "many";
  /** The record field the parts land in. */
  readonly into: "handler" | "support" | "test";
  /** Whether the endpoint's route is looked for when nothing is marked. */
  readonly derive: boolean;
  /** The bundle roles a mark of this kind may sit in. */
  readonly roles: readonly string[];
  readonly assert: readonly AssertionName[];
}

export const KINDS: Readonly<Record<KindName, Kind>> = {
  handler: {
    what: "the lines that answer the request",
    selects: "endpoint",
    required: "every",
    cardinality: "one",
    into: "handler",
    derive: true,
    roles: ["source", "host", "contract"],
    assert: ["not_only_annotations"],
  },
  wiring: {
    what: "the code that makes a feature family work, which the route does not name",
    selects: "family",
    required: "declared",
    cardinality: "many",
    into: "support",
    derive: false,
    roles: ["source", "host", "config", "contract"],
    assert: ["mentions_dep"],
  },
  test: {
    what: "a test in the framework's own suite that holds it to an endpoint",
    selects: "endpoint",
    required: "asserted",
    cardinality: "many",
    into: "test",
    derive: false,
    roles: ["test"],
    assert: ["names_endpoint"],
  },
};

export interface Assertion {
  /** How a count of failures is printed. */
  readonly label: string;
  readonly scope: "handler" | "family" | "coverage" | "test";
  readonly what: string;
  readonly why: string;
  /** Subjects, endpoint ids or families, that the assertion does not ask. */
  readonly except: readonly string[];
}

export const ASSERTIONS: Readonly<Record<AssertionName, Assertion>> = {
  not_only_annotations: {
    label: "annotation-only",
    scope: "handler",
    what: "a snippet may not be nothing but annotations, attributes and comments",
    why: '@Get("/json/small") names the route and passes both location checks, and says nothing about what answers the request',
    except: [],
  },
  mentions_dep: {
    label: "wiring that does not name its dependency",
    scope: "family",
    what: "the support parts for a family must mention the dependency rb.json declares for it",
    why: "a mark that drifted onto neighbouring lines stops mentioning it, and is otherwise indistinguishable from a correct one",
    except: [],
  },
  no_test: {
    label: "endpoint with no test",
    scope: "coverage",
    what: "every endpoint is held by at least one test in its framework's own suite, marked for it by name. A helper marked for a family or for the framework is not a test of it",
    why: 'required "every" would drop the record of every endpoint with no test and empty the snippet map, so it is asked as an assertion instead',
    except: [],
  },
  names_endpoint: {
    label: "test that does not name its endpoint",
    scope: "test",
    what: "a test marked for an endpoint by name has to contain the endpoint's id. A helper marked for a family or the framework cannot name every endpoint it serves and is not asked to",
    why: "a mark that drifted onto neighbouring lines stops naming its endpoint, and is otherwise indistinguishable from a correct one",
    except: [],
  },
};
