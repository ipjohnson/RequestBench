package unittests

import (
	"net/http"
	"testing"
)

// rb:test authorized.allowed,authorized.denied
func TestAuthorized(t *testing.T) {
	t.Run("authorized.allowed", func(t *testing.T) {
		response := get(t, "/authorized/small", "Authorization", "Bearer 5a7cc77ed0dcb825806b6f872026c317")

		assertOK(t, payload(t, "items.small.json"), response)
	})

	t.Run("authorized.denied", func(t *testing.T) {
		response := get(t, "/authorized/small", "Authorization", "Bearer 5a7cc77ed0dcb825806b6f872026c310")

		assertStatus(t, response, http.StatusForbidden)
		if body := string(bodyOf(t, response)); body != "Forbidden\n" {
			t.Fatalf("http.Error writes its text and a newline, got %q", body)
		}
	})
}

func TestNoTokenIsRefused(t *testing.T) {
	assertStatus(t, get(t, "/authorized/small"), http.StatusForbidden)
}
