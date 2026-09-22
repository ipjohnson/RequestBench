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
		if body := bodyOf(t, response); len(body) != 0 {
			t.Fatalf("gin's abort writes no body, got %q", body)
		}
	})
}

func TestNoTokenIsRefused(t *testing.T) {
	assertStatus(t, get(t, "/authorized/small"), http.StatusForbidden)
}
