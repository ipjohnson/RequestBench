comma := ,

.PHONY: fixture plan spec machine bundle snippets build java lint validate conform exemplars run vars report clean help
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

build: ## build container images  (TARGETS=go:net-http,go:gin,go:echo)
	@for t in $$(echo $(TARGETS) | tr ',' ' '); do \
	  lang=$${t%%:*}; name=$${t#*:}; \
	  case $$name in net-http|node-http|bare-netty) dir=baseline;; *) dir=$$name;; esac; \
	  echo "building rb/$$lang-$$name"; \
	  docker build -q -f targets/$$lang/Dockerfile --build-arg TARGET=$$dir \
	    -t rb/$$lang-$$name . >/dev/null; \
	done

java: ## build the java target jars, which MODE=local needs  (TARGETS=java:bare-netty)
	@mods=$$(for t in $$(echo $(TARGETS) | tr ',' ' '); do \
	  name=$${t#*:}; \
	  case $$name in bare-netty) echo baseline;; *) echo $$name;; esac; \
	done | paste -sd, -); \
	cd targets/java && mvn -B -q -pl "$$mods" -am -DskipTests package

lint: ## parse every workflow file, and run actionlint when it is installed
	python3 harness/lintyaml.py
	@command -v actionlint >/dev/null && actionlint -color || \
	  echo "  (actionlint not installed; CI runs it, with shellcheck, which catches more)"

validate: ## boot and conform, no load  (TARGETS= LANGUAGES= FRAMEWORKS= MODE=)
	python3 harness/run.py $(select) --mode $(MODE) --validate-only $(ARGS)

conform: ## gate a already-running target on 127.0.0.1:8080  (REF= to compare)
	python3 harness/conform.py 127.0.0.1:8080 $(if $(REF),--compare $(REF),)

snippets: ## where every endpoint is wired, per target  (TARGETS= or --all)
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
	  PINNED     'set to 1 to refuse an unpinned machine' \
	  ARGS       'anything else, passed to harness/run.py verbatim'

report: ## the newest run, both rates, per target
	python3 harness/report.py $$(ls -t results/*.jsonl | head -1) --family

clean:
	rm -f results/*.jsonl results/.gen-*.json results/.ref-*.json
