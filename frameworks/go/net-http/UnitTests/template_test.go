package unittests

import (
	"net/http"
	"strings"
	"testing"
)

// rb:test template.small,template.medium
func TestThePageIsRendered(t *testing.T) {
	for _, row := range []struct{ id, path, file string }{
		{"template.small", "/template/small", "items.small.json"},
		{"template.medium", "/template/medium", "items.medium.json"},
	} {
		t.Run(row.id, func(t *testing.T) {
			response := get(t, row.path)

			assertStatus(t, response, http.StatusOK)
			if kind := response.Header.Get("Content-Type"); !strings.Contains(kind, "html") {
				t.Fatalf("content type %q", kind)
			}
			if got, want := normal(string(bodyOf(t, response))), normal(page(t, row.file)); got != want {
				t.Fatalf("expected %s\n     got %s", want, got)
			}
		})
	}
}
