package main

import (
	"bytes"
	// This target already declares a gzip of its own in compressed.go, and a test shares
	// its package, so the standard library's has to answer to another name.
	gunzip "compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"testing"
)

// rb:test *
// What every test asserts before it asserts anything of its own.
//
// A port of difference() in client/src/expectation.ts, in its order and with its rules. The
// order is the point: a target answering the right values as text/plain is not answering
// correctly, so the kind of body is checked before the body. A suite stricter than the client
// fails a target the client passes, and a looser one passes a target `make test` rejects.
type answer struct {
	Status      int
	ContentType string
	Encoding    string
	// The bytes the target sent, before anything decoded them.
	Raw     []byte
	Headers http.Header
}

func assertFloor(t *testing.T, a plannedRequest, got answer) {
	t.Helper()
	if why := floorDifference(a.Want, got); why != "" {
		t.Fatalf("%s: %s", a.Key, why)
	}
}

func floorDifference(want map[string]any, got answer) string {
	if status := int(want["status"].(float64)); got.Status != status {
		return fmt.Sprintf("expected %d, got %d", status, got.Status)
	}
	// A nil is a field spec/expected.json deliberately does not pin; its "unpinned" block
	// says which. compressed.gzip_small is the one this suite meets.
	class := bodyClassOf(got.ContentType)
	if w, pinned := want["body_class"].(string); pinned && class != w {
		return fmt.Sprintf("expected a %s body, got %s", w, class)
	}
	if w, pinned := want["encoding"].(string); pinned && got.Encoding != w {
		return fmt.Sprintf("expected content-encoding %s, got %s", identity(w), identity(got.Encoding))
	}
	return firstDifference(comparableBody(gunzipped(got), got.ContentType), want["body"], "response")
}

func identity(encoding string) string {
	if encoding == "" {
		return "identity"
	}
	return encoding
}

func bodyClassOf(contentType string) string {
	ctype := strings.ToLower(contentType)
	switch {
	case strings.Contains(ctype, "json"):
		return "json"
	case strings.Contains(ctype, "html"):
		return "html"
	case strings.Contains(ctype, "text"):
		return "text"
	case ctype == "":
		return "none"
	}
	return "other"
}

// gunzipped undoes gzip before the comparison: gzip output differs between zlib, Java's
// Deflater and Go's compress/flate at the same level, and the decompressed bytes must not.
func gunzipped(got answer) []byte {
	if len(got.Raw) == 0 || !strings.Contains(got.Encoding, "gzip") {
		return got.Raw
	}
	r, err := gunzip.NewReader(bytes.NewReader(got.Raw))
	if err != nil {
		return got.Raw
	}
	plain, err := io.ReadAll(r)
	if err != nil {
		return got.Raw
	}
	return plain
}

var (
	asciiRuns = regexp.MustCompile(`[ \t\n\r\f\v]+`)
	afterTag  = regexp.MustCompile(`> +`)
	beforeTag = regexp.MustCompile(` +<`)
)

// comparableBody is the response as a value rather than as bytes, so key order and 18928.0
// stop mattering.
func comparableBody(raw []byte, contentType string) any {
	if len(raw) == 0 {
		return nil
	}
	if strings.Contains(contentType, "json") {
		var v any
		if err := json.Unmarshal(raw, &v); err != nil {
			return "unparseable-json"
		}
		return v
	}
	text := string(raw)
	if strings.Contains(contentType, "html") {
		// Five template engines cannot agree on formatting, so the spec pins content and
		// leaves whitespace free: same elements, same order, same values.
		text = asciiRuns.ReplaceAllString(text, " ")
		text = afterTag.ReplaceAllString(text, ">")
		text = strings.TrimSpace(beforeTag.ReplaceAllString(text, "<"))
	}
	return text
}

func typeName(v any) string {
	switch x := v.(type) {
	case nil:
		return "NoneType"
	case []any:
		return "list"
	case map[string]any:
		return "dict"
	case string:
		return "str"
	case bool:
		return "bool"
	case float64:
		if x == math.Trunc(x) {
			return "int"
		}
		return "float"
	}
	return fmt.Sprintf("%T", v)
}

func firstDifference(a, b any, path string) string {
	ta, tb := typeName(a), typeName(b)
	_, an := a.(float64)
	_, bn := b.(float64)
	if ta != tb && !(an && bn) {
		return fmt.Sprintf("%s: %s vs %s", path, ta, tb)
	}
	switch x := a.(type) {
	case map[string]any:
		y := b.(map[string]any)
		keys := map[string]bool{}
		for k := range x {
			keys[k] = true
		}
		for k := range y {
			keys[k] = true
		}
		sorted := make([]string, 0, len(keys))
		for k := range keys {
			sorted = append(sorted, k)
		}
		sort.Strings(sorted)
		for _, k := range sorted {
			xv, inX := x[k]
			yv, inY := y[k]
			if !inX {
				return fmt.Sprintf("%s.%s: missing here, present in the reference", path, k)
			}
			if !inY {
				return fmt.Sprintf("%s.%s: present here, missing in the reference", path, k)
			}
			if d := firstDifference(xv, yv, path+"."+k); d != "" {
				return d
			}
		}
		return ""
	case []any:
		y := b.([]any)
		if len(x) != len(y) {
			return fmt.Sprintf("%s: %d items vs %d", path, len(x), len(y))
		}
		for i := range x {
			if d := firstDifference(x[i], y[i], fmt.Sprintf("%s[%d]", path, i)); d != "" {
				return d
			}
		}
		return ""
	}
	if a == b {
		return ""
	}
	return fmt.Sprintf("%s: %v vs %v", path, a, b)
}

// rb:end
