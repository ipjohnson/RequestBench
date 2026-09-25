// Package unittests holds the Implementation to the corpus, family by family, through humatest,
// Huma's test utility, which hands each request to the API's adapter and so to the ServeMux. Each
// test is a subtest named for the corpus id it covers, so `go test ./UnitTests -run '/json.small'`
// runs one.
package unittests

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/humatest"

	implementation "github.com/ipjohnson/RequestBench/frameworks/go/huma/Implementation"
)

// api is the Implementation's Huma API, and mux the ServeMux it registered its operations on.
var (
	api huma.API
	mux *http.ServeMux
)

// directory is tests/payloads, which the answers are read from.
var directory string

func TestMain(m *testing.M) {
	directory = payloadDirectory()
	payloads, err := implementation.Load(directory)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	mux, api = implementation.New(payloads)
	os.Exit(m.Run())
}

// client is humatest's client for the API. It logs each exchange to the test.
func client(t *testing.T) humatest.TestAPI {
	t.Helper()
	return humatest.Wrap(t, api)
}

// payloadDirectory is RB_PAYLOADS, which `npm run rb -- suite` sets, or tests/payloads found by
// walking up from the package.
func payloadDirectory() string {
	if named := os.Getenv("RB_PAYLOADS"); named != "" {
		return named
	}
	dir, _ := os.Getwd()
	for {
		candidate := filepath.Join(dir, "tests", "payloads")
		if _, err := os.Stat(filepath.Join(candidate, "items.large.json")); err == nil {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			panic("no tests/payloads above the working directory, and RB_PAYLOADS is not set")
		}
		dir = parent
	}
}

// file is a committed payload's bytes.
func file(t *testing.T, name string) []byte {
	t.Helper()
	bytes, err := os.ReadFile(filepath.Join(directory, name))
	if err != nil {
		t.Fatal(err)
	}
	return bytes
}

// parsed is JSON as encoding/json reads it into interfaces, so two values compare with DeepEqual
// whatever order their keys came in.
func parsed(t *testing.T, raw []byte) any {
	t.Helper()
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		t.Fatalf("not JSON: %v: %s", err, raw)
	}
	return value
}

// payload is a committed JSON payload, parsed.
func payload(t *testing.T, name string) any {
	t.Helper()
	return parsed(t, file(t, name))
}

// withEcho is a payload with an echo object beside its own fields, as a binding handler answers.
func withEcho(t *testing.T, name string, echo map[string]any) any {
	t.Helper()
	value := payload(t, name).(map[string]any)
	value["echo"] = echo
	return value
}

func assertStatus(t *testing.T, response *httptest.ResponseRecorder, want int) {
	t.Helper()
	if response.Code != want {
		t.Fatalf("status %d, want %d: %s", response.Code, want, response.Body)
	}
}

// assertJSON checks the whole answer against a value.
func assertJSON(t *testing.T, want any, response *httptest.ResponseRecorder) {
	t.Helper()
	got := parsed(t, response.Body.Bytes())
	if !reflect.DeepEqual(want, got) {
		t.Fatalf("expected %v\n     got %v", want, got)
	}
}

// assertOK checks for a 200 carrying exactly this value.
func assertOK(t *testing.T, want any, response *httptest.ResponseRecorder) {
	t.Helper()
	assertStatus(t, response, http.StatusOK)
	assertJSON(t, want, response)
}

func assertHeader(t *testing.T, response *httptest.ResponseRecorder, name, want string) {
	t.Helper()
	if got := response.Header().Get(name); got != want {
		t.Fatalf("%s %q, want %q", name, got, want)
	}
}

func assertNoHeader(t *testing.T, response *httptest.ResponseRecorder, name string) {
	t.Helper()
	if got, ok := response.Header()[http.CanonicalHeaderKey(name)]; ok {
		t.Fatalf("unexpected %s %q", name, got)
	}
}

func serial(t *testing.T, response *httptest.ResponseRecorder) uint64 {
	t.Helper()
	value, err := strconv.ParseUint(response.Header().Get("x-rb-serial"), 10, 64)
	if err != nil {
		t.Fatalf("x-rb-serial %q: %v", response.Header().Get("x-rb-serial"), err)
	}
	return value
}

// page is the page the template rows render, as tests/payloads/index.ts writes it.
func page(t *testing.T, name string) string {
	t.Helper()
	var p implementation.Payload
	if err := json.Unmarshal(file(t, name), &p); err != nil {
		t.Fatal(err)
	}
	var rows strings.Builder
	for _, it := range p.Items {
		stock := "no"
		if it.InStock {
			stock = "yes"
		}
		fmt.Fprintf(&rows, "<tr><td>%d</td><td>%s</td><td>%s</td><td>%d</td><td>%s</td></tr>", it.ID, it.Name, it.Category, it.PriceCents, stock)
	}
	return "<!doctype html><html><head><title>items</title></head><body>" +
		"<h1>" + p.Size + "</h1><table><thead><tr><th>id</th><th>name</th><th>category</th><th>price</th><th>stock</th></tr></thead>" +
		"<tbody>" + rows.String() + "</tbody></table><p>" + strconv.Itoa(p.Count) + " rows</p></body></html>"
}

var (
	runs     = regexp.MustCompile(`[ \t\n\r\f\v]+`)
	before   = regexp.MustCompile(`[ ]+<`)
	boundary = regexp.MustCompile(`>[ ]+`)
)

// normal removes whitespace at element boundaries and collapses every other run, as the corpus
// compares a page.
func normal(html string) string {
	collapsed := runs.ReplaceAllString(html, " ")
	return strings.TrimSpace(before.ReplaceAllString(boundary.ReplaceAllString(collapsed, ">"), "<"))
}
