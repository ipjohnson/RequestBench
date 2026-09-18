package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// rb:test *
// What a correct answer is, and which request asks for it.
//
// Both come out of spec/. spec/expected.json is the only authority on a correct answer and
// the conformance client is the only thing that judges a target against it, so a suite that
// passes while `make test` fails this target is the suite that is wrong, and writing a status
// or a body into a test as a literal is how the two drift apart. spec/plan.json is where an
// order id, a query string and a request body come from.
//
// Instance zero, always. An endpoint sends up to 512 requests and the conformance client
// replays every one; a suite sends one, so it has to be the same one on every run or a
// failure would not reproduce.
//
// The names are long on purpose. A Go test shares its package with the code it tests, and
// this target already has functions called send, fail and ok.
type plannedRequest struct {
	ID, Key, Method, Path string
	Headers               map[string]string
	Body                  *string
	// nil for an error endpoint: its envelope is the framework's own contract, and
	// assertEnvelope rather than assertFloor is what judges it.
	Want map[string]any
}

var (
	specOnce sync.Once
	specRoot string
	specPlan struct {
		Endpoints []struct {
			ID             string              `json:"id"`
			Method         string              `json:"method"`
			Paths          []string            `json:"paths"`
			Headers        map[string]string   `json:"headers"`
			HeaderVariants []map[string]string `json:"header_variants"`
			Body           *string             `json:"body"`
		} `json:"endpoints"`
		Captures map[string]struct{ Method, Path, Header string } `json:"captures"`
	}
	specExpected struct {
		Errors   map[string]any                       `json:"errors"`
		Requests map[string]map[string]any            `json:"requests"`
		Targets  map[string]map[string]map[string]any `json:"targets"`
	}
)

func readSpec() {
	specOnce.Do(func() {
		dir, _ := os.Getwd()
		for {
			if _, err := os.Stat(filepath.Join(dir, "spec", "expected.json")); err == nil {
				break
			}
			dir = filepath.Dir(dir)
		}
		specRoot = dir
		for name, into := range map[string]any{"plan.json": &specPlan, "expected.json": &specExpected} {
			raw, err := os.ReadFile(filepath.Join(dir, "spec", name))
			if err != nil {
				panic(err)
			}
			if err := json.Unmarshal(raw, into); err != nil {
				panic(err)
			}
		}
	})
}

// planFor is one of an endpoint's requests, and the answer pinned for it.
func planFor(id string) plannedRequest {
	readSpec()
	for _, ep := range specPlan.Endpoints {
		if ep.ID != id {
			continue
		}
		headers := map[string]string{}
		for k, v := range ep.Headers {
			headers[k] = v
		}
		// A vary row sends a different header set per instance, which is what the response
		// cache is keyed on. Instance zero, for the reason above.
		if len(ep.HeaderVariants) > 0 {
			for k, v := range ep.HeaderVariants[0] {
				headers[k] = v
			}
		}
		if ep.Body != nil {
			headers["content-type"] = "application/json"
		}
		key := id + " " + ep.Paths[0]
		var want map[string]any
		if _, isError := specExpected.Errors[id]; !isError {
			want = specExpected.Requests[key]
		}
		return plannedRequest{id, key, ep.Method, ep.Paths[0], headers, ep.Body, want}
	}
	panic("spec/plan.json has no endpoint " + id)
}

// captureFor is the request a validator is taken from, for the one endpoint that needs one
// first: etag.match_large carries {capture.etag_large}, which only the target can produce.
func captureFor(a plannedRequest) (method, path, header string) {
	for _, v := range a.Headers {
		if strings.HasPrefix(v, "{capture.") {
			c := specPlan.Captures[v[len("{capture."):len(v)-1]]
			return c.Method, c.Path, c.Header
		}
	}
	panic(a.ID + " captures nothing")
}

// withCapture is the same headers with the capture's placeholder replaced.
func withCapture(a plannedRequest, captured string) map[string]string {
	out := map[string]string{}
	for k, v := range a.Headers {
		if strings.HasPrefix(v, "{capture.") {
			v = captured
		}
		out[k] = v
	}
	return out
}

// recordedEnvelope is the error envelope this target recorded, or nil.
func recordedEnvelope(target, key string) map[string]any {
	readSpec()
	return specExpected.Targets[target][key]
}

// rb:end
