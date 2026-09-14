.PHONY: fixture plan build java lint validate conform run report clean help
TARGETS ?= node:node-http,node:fastify,node:express
SECONDS ?=
RUNGS ?=
MODE ?= local

help:
	@grep -E '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | sed 's/:.*## /\t/' | column -t -s"$$(printf '\t')"

fixture: ## regenerate the shared fixture (commit the result)
	python3 harness/make_fixture.py

plan: ## expand spec/endpoints.json into spec/plan.json
	python3 harness/plan.py

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

validate: ## boot and conform every named target, no load  (TARGETS= MODE=)
	python3 harness/run.py --targets $(TARGETS) --mode $(MODE) --validate-only

conform: ## gate a already-running target on 127.0.0.1:8080
	python3 harness/conform.py 127.0.0.1:8080 --compare spec/fingerprint.node-http.json

run: ## boot, gate, warm, ladder, record  (TARGETS= SECONDS= RUNGS= MODE=)
	python3 harness/run.py --targets $(TARGETS) \
	  $(if $(SECONDS),--seconds $(SECONDS),) $(if $(RUNGS),--rungs $(RUNGS),)

report: ## ratios for the newest run
	python3 harness/report.py $$(ls -t results/*.jsonl | head -1) --family

clean:
	rm -f results/*.jsonl results/.gen-*.json
