comma := ,

.PHONY: fixture plan spec expected test suites machine bundle snippets build client site site-dev java rust dotnet python python-lock lint validate conform expect exemplars run vars report clean help
# Everything is on by default: no TARGETS means every implemented target this host
# supports. The rest narrow it. LANGUAGES/FRAMEWORKS pick what runs, FAMILIES/ENDPOINTS
# pick what it is asked for, and a narrowed endpoint set is recorded as its own profile
# because the runtime optimises for the paths it executes.
TARGETS ?=
LANGUAGES ?=
FRAMEWORKS ?=
FAMILIES ?=
ENDPOINTS ?=
NOT_LANGUAGES ?=
NOT_FRAMEWORKS ?=
NOT_FAMILIES ?=
NOT_ENDPOINTS ?=
SECONDS ?=
WARMUP ?=
RPS ?=
RUNGS ?=
MODE ?= local
ARGS ?=
# The targets spec/expected.json is derived from: four languages, four HTTP stacks, four
# independent implementations. A value only some of them produce is not an expectation.
EXPECT_FROM ?= node:fastify,go:gin,rust:axum,python:fastapi
# Tests boot containers by default, not host processes. The container is what measurement
# runs, and it is the only mode that does not need five toolchains on the machine.
TEST_MODE ?= docker
# One target for `make conform` and `make expect`, which talk to something already running.
# They are told where it is: harness/run.py gives each container its own port now, and 8080
# is only right for one started by hand with a plain `docker run -p 8080:8080`.
TARGET ?=
PORT ?= 8080

select = $(if $(TARGETS),--targets $(TARGETS),) \
	 $(if $(LANGUAGES),--languages $(LANGUAGES),) \
	 $(if $(FRAMEWORKS),--frameworks $(FRAMEWORKS),) \
	 $(if $(FAMILIES),--families $(FAMILIES),) \
	 $(if $(ENDPOINTS),--endpoints $(ENDPOINTS),) \
	 $(if $(NOT_LANGUAGES),--not-languages $(NOT_LANGUAGES),) \
	 $(if $(NOT_FRAMEWORKS),--not-frameworks $(NOT_FRAMEWORKS),) \
	 $(if $(NOT_FAMILIES),--not-families $(NOT_FAMILIES),) \
	 $(if $(NOT_ENDPOINTS),--not-endpoints $(NOT_ENDPOINTS),)

help:
	@grep -E '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | sed 's/:.*## /\t/' | column -t -s"$$(printf '\t')"

fixture: ## regenerate the shared fixture (commit the result)
	python3 harness/make_fixture.py

plan: ## expand spec/endpoints.json into spec/plan.json and spec/sequence.json
	python3 harness/plan.py
	python3 harness/sequence.py

spec: fixture plan ## regenerate every generated spec file (commit the result)

machine: ## what this machine is, and whether it is fit to measure on
	python3 harness/machine.py

bundle: ## file list and hashes for every implemented target's bundle
	python3 harness/bundle.py --all --summary

build: ## build container images  (TARGETS=go:gin,go:echo)
	@set -e; for t in $$(echo $(TARGETS) | tr ',' ' '); do \
	  lang=$${t%%:*}; name=$${t#*:}; \
	  echo "building rb/$$lang-$$name"; \
	  docker build -q -f targets/$$lang/Dockerfile --build-arg TARGET=$$name \
	    -t rb/$$lang-$$name . >/dev/null \
	    || { echo "  FAILED to build rb/$$lang-$$name" >&2; exit 1; }; \
	done

java: ## build the java target jars, which MODE=local needs  (TARGETS=java:javalin)
	@mods=$$(for t in $$(echo $(TARGETS) | tr ',' ' '); do \
	  echo $${t#*:}; \
	done | paste -sd, -); \
	cd targets/java && mvn -B -q -pl "$$mods" -am -DskipTests package

rust: ## build the rust target binaries, which speeds MODE=local up
	cd targets/rust && cargo build --locked --bins

dotnet: ## build the dotnet targets, which MODE=local needs  (TARGETS=dotnet:carter)
	cd targets/dotnet && dotnet build -c Release --nologo $(if $(TARGETS),$(subst dotnet:,,$(TARGETS))/*.csproj,)

python: ## create the python virtualenv MODE=local needs, from the pinned lockfile
	python3 -m venv targets/python/.venv
	targets/python/.venv/bin/python -m pip install -q -r targets/python/requirements.txt

python-lock: ## recompile targets/python/requirements.txt from requirements.in
	targets/python/.venv/bin/python -m pip install -q pip-tools
	cd targets/python && .venv/bin/python -m piptools compile --quiet --strip-extras \
	  --output-file requirements.txt requirements.in

test: client ## boot every target and check every endpoint against spec/expected.json
	python3 harness/run.py $(select) --mode $(TEST_MODE) --expect $(ARGS)

# Each target's own suite, which is a different thing from `make test`. `make test` boots a
# target and checks every endpoint against spec/expected.json through the conformance client,
# and it is the authority: a suite that passes while `make test` fails that target is the
# suite that is wrong. These run no load and are never part of a measurement.
# fastendpoints runs on its own: FastEndpoints.Testing is built on xunit.v3, a Microsoft
# Testing Platform runner, and `dotnet test` on the .NET 10 SDK refuses a solution that mixes
# one with VSTest. Both halves run whatever the first one did, so a failure in one never
# hides the result of the other.
suites: ## run each target's own test suite  (dotnet only so far)
	@cd targets/dotnet && status=0; \
	  dotnet test suite/RequestBench.Suites.slnx -c Release --nologo || status=1; \
	  dotnet run --project fastendpoints/suite/RequestBench.FastEndpoints.Suite.csproj \
	    -c Release || status=1; \
	  exit $$status

expected: ## re-derive spec/expected.json from the targets named in EXPECT_FROM
	python3 harness/expected.py --targets $(EXPECT_FROM) --mode $(MODE) --write

lint: ## lint the workspace and the workflow files
	npm run lint --silent
	python3 harness/lintyaml.py
	@command -v actionlint >/dev/null && actionlint -color || \
	  echo "  (actionlint not installed; CI runs it, with shellcheck, which catches more)"

validate: ## boot and conform, no load  (TARGETS= LANGUAGES= FRAMEWORKS= MODE=)
	python3 harness/run.py $(select) --mode $(MODE) --validate-only $(ARGS)

conform: client ## gate an already-running target  (TARGET=go:gin, PORT=, REF= to compare)
	node client/dist/cli.js 127.0.0.1:$(PORT) --target $(TARGET) $(if $(REF),--compare $(REF),)

expect: client ## check an already-running target against spec/expected.json  (TARGET=go:gin, PORT=)
	node client/dist/cli.js 127.0.0.1:$(PORT) --target $(TARGET) --mode expect

client: ## build the TypeScript workspace, which every check now runs through
	npm run build --silent

# Summaries live on the orphan `results` branch, so a local build needs somewhere to read them
# from: SUMMARIES=_results/summary after checking that branch out, or nothing for a shell that
# fetches them at runtime. DATA_BASE points the published page at a results site instead of at
# the data directory this writes.
SUMMARIES ?=
DATA_BASE ?=

site: ## render site/dist  (SUMMARIES=<dir> DATA_BASE=<url>)
	node site/tools/build.js \
	  $(if $(SUMMARIES),--summaries $(SUMMARIES),) \
	  --exemplars results/exemplars --out site/dist \
	  $(if $(DATA_BASE),--data-base $(DATA_BASE),)

site-dev: ## the site with a reloading server  (SUMMARIES=<dir> DATA_BASE=<url>)
	RB_ROOT=$(CURDIR) RB_SUMMARIES=$(SUMMARIES) RB_EXEMPLARS=results/exemplars \
	  RB_DATA_BASE=$(DATA_BASE) npm --prefix site run dev

snippets: ## where every endpoint and family is wired, per target  (TARGETS= or --all)
	python3 harness/snippets.py $(if $(TARGETS),$(subst $(comma), ,$(TARGETS)),--all) --summary

exemplars: ## recapture results/exemplars  (TARGETS= LANGUAGES= FRAMEWORKS= MODE=)
	python3 harness/run.py $(select) --mode $(MODE) --validate-only --exemplars $(ARGS)

run: ## boot, gate, warm, measure, record  (see `make vars`)
	python3 harness/run.py $(select) --mode $(MODE) \
	  $(if $(SECONDS),--seconds $(SECONDS),) $(if $(WARMUP),--warmup $(WARMUP),) \
	  $(if $(RPS),--rps $(RPS),) $(if $(RUNGS),--rungs $(RUNGS),) \
	  $(if $(PINNED),--require-pinned,) $(ARGS)

vars: ## every variable `make run` takes, and what it defaults to
	@printf '%-11s %s\n' \
	  TARGETS    'language:target,... exactly. Default: everything this host supports' \
	  LANGUAGES  'only these languages. Prefix any of these with NOT_ to invert' \
	  FRAMEWORKS 'only these frameworks, any language' \
	  FAMILIES   'only these endpoint families. Records its own profile' \
	  ENDPOINTS  'only these endpoint ids. Records its own profile' \
	  RUNGS      'which rates: regular, raised, or both. Default: both' \
	  RPS        'offered rate per selected rate. Default: spec/ladder.json' \
	  SECONDS    'seconds per rate. Default: spec/ladder.json' \
	  WARMUP     'warmup seconds. Default: by language warmup class' \
	  MODE       'local or docker. Default: local' \
	  TEST_MODE  'how `make test` boots a target. Default: docker' \
	  EXPECT_FROM 'targets `make expected` derives the expectation from' \
	  PINNED     'set to 1 to refuse an unpinned machine' \
	  ARGS       'anything else, passed to harness/run.py verbatim'

report: ## the newest run, both rates, per target
	python3 harness/report.py $$(ls -t results/*.jsonl | head -1) --family

clean:
	rm -f results/*.jsonl results/.gen-*.json results/.ref-*.json
	rm -rf site/dist site/.astro
