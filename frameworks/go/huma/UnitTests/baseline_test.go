package unittests

import (
	"net/http"
	"testing"
)

// rb:test baseline.plaintext
func TestBaseline(t *testing.T) {
	t.Run("baseline.plaintext", func(t *testing.T) {
		response := client(t).Get("/plaintext")

		assertStatus(t, response, http.StatusOK)
		assertHeader(t, response, "Content-Type", "text/plain; charset=utf-8")
		if body := response.Body.String(); body != "Hello, World!" {
			t.Fatalf("body %q", body)
		}
	})
}
