.PHONY: fixture plan build lint validate conform run report clean help
SHARD ?= node
TARGETS ?= node-http,fastify,express
SECONDS ?=
RUNGS ?=
MODE ?= local

help:
	@grep -E '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | sed 's/:.*## /\t/' | column -t -s"$$(printf '\t')"

fixture: ## regenerate the shared fixture (commit the result)
	python3 harness/make_fixture.py

plan: ## expand spec/endpoints.json into spec/plan.json
	python3 harness/plan.py

build: ## build container images for a shard  (SHARD=go TARGETS=net-http,gin,echo)
	@for t in $$(echo $(TARGETS) | tr ',' ' '); do \
	  case $$t in net-http|node-http) dir=baseline;; *) dir=$$t;; esac; \
	  echo "building rb/$(SHARD)-$$t"; \
	  docker build -q -f targets/$(SHARD)/Dockerfile --build-arg TARGET=$$dir \
	    -t rb/$(SHARD)-$$t . >/dev/null; \
	done

lint: ## parse every workflow file, and run actionlint when it is installed
	python3 harness/lintyaml.py
	@command -v actionlint >/dev/null && actionlint -color || \
	  echo "  (actionlint not installed; CI runs it. see docs/runner.md)"

validate: ## boot and conform every target in a shard, no load  (SHARD= TARGETS= MODE=)
	python3 harness/run.py --shard $(SHARD) --targets $(TARGETS) --mode $(MODE) --validate-only

conform: ## gate a already-running target on 127.0.0.1:8080
	python3 harness/conform.py 127.0.0.1:8080 --compare spec/fingerprint.node-http.json

run: ## boot, gate, warm, ladder, record  (SHARD= TARGETS= SECONDS= RUNGS= MODE=)
	python3 harness/run.py --shard $(SHARD) --targets $(TARGETS) \
	  $(if $(SECONDS),--seconds $(SECONDS),) $(if $(RUNGS),--rungs $(RUNGS),)

report: ## ratios for the newest run
	python3 harness/report.py $$(ls -t results/*.jsonl | head -1) --family

clean:
	rm -f results/*.jsonl results/.gen-*.json
