package unittests

import (
	"net/http"
	"testing"
)

// rb:test template.small,template.medium
func TestThePageIsRendered(t *testing.T) {
	for _, row := range []struct{ id, path, file string }{
		{"template.small", "/template/small", "items.small.json"},
		{"template.medium", "/template/medium", "items.medium.json"},
	} {
		t.Run(row.id, func(t *testing.T) {
			response := client(t).Get(row.path)

			assertStatus(t, response, http.StatusOK)
			assertHeader(t, response, "Content-Type", "text/html; charset=utf-8")
			if got, want := normal(response.Body.String()), normal(page(t, row.file)); got != want {
				t.Fatalf("expected %s\n     got %s", want, got)
			}
		})
	}
}
