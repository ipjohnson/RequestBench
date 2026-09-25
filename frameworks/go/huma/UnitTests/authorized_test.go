package unittests

import (
	"net/http"
	"testing"
)

// rb:test authorized.allowed,authorized.denied
func TestAuthorized(t *testing.T) {
	t.Run("authorized.allowed", func(t *testing.T) {
		response := client(t).Get("/authorized/small", "Authorization: Bearer 5a7cc77ed0dcb825806b6f872026c317")

		assertOK(t, payload(t, "items.small.json"), response)
	})

	t.Run("authorized.denied", func(t *testing.T) {
		response := client(t).Get("/authorized/small", "Authorization: Bearer 5a7cc77ed0dcb825806b6f872026c310")

		assertStatus(t, response, http.StatusForbidden)
		assertHeader(t, response, "Content-Type", "application/problem+json")
		assertJSON(t, map[string]any{"title": "Forbidden", "status": 403.0, "detail": "Forbidden"}, response)
	})
}

func TestNoTokenIsRefused(t *testing.T) {
	assertStatus(t, client(t).Get("/authorized/small"), http.StatusForbidden)
}

func TestTheOperationDeclaresTheBearerScheme(t *testing.T) {
	op := api.OpenAPI().Paths["/authorized/small"].Get

	if len(op.Security) != 1 || op.Security[0]["bearer"] == nil {
		t.Fatalf("security %v", op.Security)
	}
}
