.PHONY: fixture plan conform run report clean help
SHARD ?= node
TARGETS ?= node-http,fastify,express
SECONDS ?=
RUNGS ?=

help:
	@grep -E '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | sed 's/:.*## /\t/' | column -t -s"$$(printf '\t')"

fixture: ## regenerate the shared fixture (commit the result)
	python3 harness/make_fixture.py

plan: ## expand spec/endpoints.json into spec/plan.json
	python3 harness/plan.py

conform: ## gate a already-running target on 127.0.0.1:8080
	python3 harness/conform.py 127.0.0.1:8080 --compare spec/fingerprint.node-http.json

run: ## boot, gate, warm, ladder, record  (SHARD= TARGETS= SECONDS= RUNGS=)
	python3 harness/run.py --shard $(SHARD) --targets $(TARGETS) \
	  $(if $(SECONDS),--seconds $(SECONDS),) $(if $(RUNGS),--rungs $(RUNGS),)

report: ## ratios for the newest run
	python3 harness/report.py $$(ls -t results/*.jsonl | head -1) --family

clean:
	rm -f results/*.jsonl results/.gen-*.json
