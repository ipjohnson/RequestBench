package main

import (
	"encoding/json"
	"maps"
	"math"
	"math/rand/v2"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
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
// failure would not reproduce. A value the plan writes as {run.<name>} is the exception. It
// is drawn once per process, so that no handler can pass by knowing it in advance.
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
		Captures  map[string]struct{ Method, Path, Header string } `json:"captures"`
		RunValues map[string]runValue                              `json:"run_values"`
	}
	specExpected struct {
		Errors   map[string]any                       `json:"errors"`
		Requests map[string]map[string]any            `json:"requests"`
		Targets  map[string]map[string]map[string]any `json:"targets"`
	}
	// Keyed by the placeholder that stands for each value, as the plan writes it.
	drawnValues = map[string]any{}
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
		for name, declared := range specPlan.RunValues {
			drawnValues["{run."+name+"}"] = drawRunValue(declared)
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
			headers[k] = runValuesInHeader(v)
		}
		// A vary row sends a different header set per instance, which is what the response
		// cache is keyed on. Instance zero, for the reason above.
		if len(ep.HeaderVariants) > 0 {
			for k, v := range ep.HeaderVariants[0] {
				headers[k] = runValuesInHeader(v)
			}
		}
		if ep.Body != nil {
			headers["content-type"] = "application/json"
		}
		// spec/expected.json is keyed by the path as the plan writes it, with its placeholders.
		key := id + " " + ep.Paths[0]
		var want map[string]any
		if _, isError := specExpected.Errors[id]; !isError {
			want = maps.Clone(specExpected.Requests[key])
		}
		if want != nil {
			want["body"] = runValuesInBody(want["body"])
		}
		return plannedRequest{id, key, ep.Method, runValuesInURL(ep.Paths[0]), headers, ep.Body, want}
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

// runValue is one declaration in the plan's run_values.
type runValue struct {
	Kind                  string
	Digits, Length, Count int
	Chars                 string
	Values                []string
}

// drawRunValue is one value as it is declared. The top-level functions of math/rand/v2 are
// seeded randomly in every process, so each run draws its own.
func drawRunValue(declared runValue) any {
	text := func() string {
		chars, out := []rune(declared.Chars), make([]rune, declared.Length)
		for i := range out {
			out[i] = chars[rand.IntN(len(chars))]
		}
		return string(out)
	}
	switch declared.Kind {
	case "int":
		lowest := int(math.Pow10(declared.Digits - 1))
		return lowest + rand.IntN(9*lowest)
	case "string":
		return text()
	case "words":
		words := make([]string, declared.Count)
		for i := range words {
			words[i] = text()
		}
		return strings.Join(words, " ")
	case "choice":
		return declared.Values[rand.IntN(len(declared.Values))]
	}
	panic("spec/plan.json declares a run value of kind " + declared.Kind)
}

var runPlaceholder = regexp.MustCompile(`\{run\.[a-z_]+\}`)

// runValueText is the value a placeholder stands for, as the text a request carries.
func runValueText(placeholder string) string {
	switch v := drawnValues[placeholder].(type) {
	case int:
		return strconv.Itoa(v)
	case string:
		return v
	}
	panic("spec/plan.json declares no " + placeholder)
}

// runValuesInURL is a path from the plan with every value in it. A space goes as %20 and
// never +, because RFC 3986 does not read + as a space.
func runValuesInURL(path string) string {
	return runPlaceholder.ReplaceAllStringFunc(path, func(placeholder string) string {
		return strings.ReplaceAll(url.QueryEscape(runValueText(placeholder)), "+", "%20")
	})
}

// runValuesInHeader is a header value from the plan with every value in it, as it is.
func runValuesInHeader(value string) string {
	return runPlaceholder.ReplaceAllStringFunc(value, runValueText)
}

// runValuesInBody is a pinned body with every string that is exactly a placeholder replaced
// by its value. It builds new maps and slices, because every test reads the same decoded file.
func runValuesInBody(node any) any {
	switch x := node.(type) {
	case string:
		switch v := drawnValues[x].(type) {
		case int:
			// A float64 is what encoding/json decodes the answer's number into, so the floor
			// compares the two like any other numbers.
			return float64(v)
		case string:
			return v
		}
	case []any:
		out := make([]any, len(x))
		for i, item := range x {
			out[i] = runValuesInBody(item)
		}
		return out
	case map[string]any:
		out := make(map[string]any, len(x))
		for k, item := range x {
			out[k] = runValuesInBody(item)
		}
		return out
	}
	return node
}

// recordedEnvelope is the error envelope this target recorded, or nil.
func recordedEnvelope(target, key string) map[string]any {
	readSpec()
	return specExpected.Targets[target][key]
}

// rb:end
