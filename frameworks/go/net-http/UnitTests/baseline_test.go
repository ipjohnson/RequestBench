package unittests

import (
	"net/http"
	"strings"
	"testing"
)

// rb:test baseline.plaintext
func TestBaseline(t *testing.T) {
	t.Run("baseline.plaintext", func(t *testing.T) {
		response := get(t, "/plaintext")

		assertStatus(t, response, http.StatusOK)
		if body := string(bodyOf(t, response)); body != "Hello, World!" {
			t.Fatalf("body %q", body)
		}
		if kind := response.Header.Get("Content-Type"); !strings.HasPrefix(kind, "text/plain") {
			t.Fatalf("content type %q", kind)
		}
	})
}
