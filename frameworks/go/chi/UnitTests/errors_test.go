package unittests

import (
	"net/http"
	"testing"
)

// rb:test errors.unmatched
func TestAPathNoRouteMatchesIsNetHTTPs404(t *testing.T) {
	t.Run("errors.unmatched", func(t *testing.T) {
		response := get(t, "/errors/unmatched")

		assertStatus(t, response, http.StatusNotFound)
		if body := string(bodyOf(t, response)); body != "404 page not found\n" {
			t.Fatalf("body %q", body)
		}
	})
}

// rb:test errors.wrong_method
func TestAMethodThePathHasNoRouteForIs405WithTheMethodsItHas(t *testing.T) {
	t.Run("errors.wrong_method", func(t *testing.T) {
		response := send(t, http.MethodPost, "/items/17", nil)

		assertStatus(t, response, http.StatusMethodNotAllowed)
		if allow := response.Header.Values("Allow"); len(allow) != 5 {
			t.Fatalf("allow %v", allow)
		}
		if body := bodyOf(t, response); len(body) != 0 {
			t.Fatalf("body %q", body)
		}
	})
}

// rb:test errors.not_found
func TestAMissingRowIsTheExamplesNotFound(t *testing.T) {
	t.Run("errors.not_found", func(t *testing.T) {
		response := get(t, "/items/999999")

		assertStatus(t, response, http.StatusNotFound)
		assertJSON(t, map[string]any{"status": "Resource not found."}, response)
	})
}

// rb:test errors.malformed
func TestABodyThatIsNotJSONIsRefusedWithTheDecodersMessage(t *testing.T) {
	t.Run("errors.malformed", func(t *testing.T) {
		response := postJSON(t, http.MethodPost, "/body/validate/small", []byte(`{"customerId": 1, "lines": [`))

		assertStatus(t, response, http.StatusBadRequest)
		assertJSON(t, map[string]any{"status": "Invalid request.", "error": "unexpected EOF"}, response)
	})
}
