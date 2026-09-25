package unittests

import (
	"net/http"
	"testing"
)

// rb:test errors.unmatched
func TestAPathNoOperationMatchesIsTheServeMuxs404(t *testing.T) {
	t.Run("errors.unmatched", func(t *testing.T) {
		response := client(t).Get("/errors/unmatched")

		assertStatus(t, response, http.StatusNotFound)
		if body := response.Body.String(); body != "404 page not found\n" {
			t.Fatalf("body %q", body)
		}
	})
}

// rb:test errors.wrong_method
func TestAMethodThePathHasNoOperationForIsTheServeMuxs405(t *testing.T) {
	t.Run("errors.wrong_method", func(t *testing.T) {
		response := client(t).Do(http.MethodPost, "/items/17")

		assertStatus(t, response, http.StatusMethodNotAllowed)
		assertHeader(t, response, "Allow", "DELETE, GET, HEAD, PATCH, PUT")
		if body := response.Body.String(); body != "Method Not Allowed\n" {
			t.Fatalf("body %q", body)
		}
	})
}

// rb:test errors.not_found
func TestAMissingRowIsHumasOwn404(t *testing.T) {
	t.Run("errors.not_found", func(t *testing.T) {
		response := client(t).Get("/items/999999")

		assertStatus(t, response, http.StatusNotFound)
		assertHeader(t, response, "Content-Type", "application/problem+json")
		assertJSON(t, map[string]any{"title": "Not Found", "status": 404.0, "detail": "no item has that id"}, response)
	})
}

// rb:test errors.malformed
func TestABodyThatIsNotJSONIsRefusedWithTheDecodersMessage(t *testing.T) {
	t.Run("errors.malformed", func(t *testing.T) {
		response := postJSON(t, http.MethodPost, "/body/validate/small", []byte(`{"customerId": 1, "lines": [`))

		assertStatus(t, response, http.StatusBadRequest)
		assertJSON(t, map[string]any{
			"title":  "Bad Request",
			"status": 400.0,
			"detail": "validation failed",
			"errors": []any{map[string]any{"message": "unexpected end of JSON input", "location": "body", "value": `{"customerId": 1, "lines": [`}},
		}, response)
	})
}
