// Package unittests holds the Implementation to the corpus, family by family. Each test is a
// subtest named for the corpus id it covers, so `go test ./UnitTests -run '/json.small'` runs one.
package unittests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	implementation "github.com/ipjohnson/RequestBench/frameworks/go/gin/Implementation"
)

// server is the Implementation served by httptest on a loopback port, which is how Go tests an
// http.Handler end to end. Each request crosses net/http as it does in the container, so a HEAD
// answer loses its body, a stream goes out chunked and gzip is on the wire.
var server *httptest.Server

// directory is tests/payloads, which the answers are read from.
var directory string

func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)
	directory = payloadDirectory()
	payloads, err := implementation.Load(directory)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	server = httptest.NewServer(implementation.Router(payloads))
	code := m.Run()
	server.Close()
	os.Exit(code)
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

// send makes one request, with headers given as name and value pairs.
func send(t *testing.T, method, path string, body io.Reader, headers ...string) *http.Response {
	t.Helper()
	request, err := http.NewRequest(method, server.URL+path, body)
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i+1 < len(headers); i += 2 {
		request.Header.Set(headers[i], headers[i+1])
	}
	response, err := server.Client().Do(request)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { response.Body.Close() })
	return response
}

func get(t *testing.T, path string, headers ...string) *http.Response {
	t.Helper()
	return send(t, http.MethodGet, path, nil, headers...)
}

// postJSON sends a body as the corpus sends a JSON one.
func postJSON(t *testing.T, method, path string, body []byte) *http.Response {
	t.Helper()
	return send(t, method, path, bytes.NewReader(body), "Content-Type", "application/json")
}

func bodyOf(t *testing.T, response *http.Response) []byte {
	t.Helper()
	body, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatal(err)
	}
	return body
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

func assertStatus(t *testing.T, response *http.Response, want int) {
	t.Helper()
	if response.StatusCode != want {
		t.Fatalf("status %d, want %d", response.StatusCode, want)
	}
}

// assertJSON checks the whole answer against a value.
func assertJSON(t *testing.T, want any, response *http.Response) {
	t.Helper()
	got := parsed(t, bodyOf(t, response))
	if !reflect.DeepEqual(want, got) {
		t.Fatalf("expected %v\n     got %v", want, got)
	}
}

// assertOK checks for a 200 carrying exactly this value.
func assertOK(t *testing.T, want any, response *http.Response) {
	t.Helper()
	assertStatus(t, response, http.StatusOK)
	assertJSON(t, want, response)
}

func serial(t *testing.T, response *http.Response) uint64 {
	t.Helper()
	value, err := strconv.ParseUint(response.Header.Get("x-rb-serial"), 10, 64)
	if err != nil {
		t.Fatalf("x-rb-serial %q: %v", response.Header.Get("x-rb-serial"), err)
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
