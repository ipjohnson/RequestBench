package unittests

import (
	"net/http"
	"testing"
)

// rb:test errors.unmatched
func TestAPathNoPatternMatchesIsTheServeMuxs404(t *testing.T) {
	t.Run("errors.unmatched", func(t *testing.T) {
		response := get(t, "/errors/unmatched")

		assertStatus(t, response, http.StatusNotFound)
		if body := string(bodyOf(t, response)); body != "404 page not found\n" {
			t.Fatalf("body %q", body)
		}
	})
}

// rb:test errors.wrong_method
func TestAMethodThePathHasNoPatternForIs405WithTheMethodsItHas(t *testing.T) {
	t.Run("errors.wrong_method", func(t *testing.T) {
		response := send(t, http.MethodPost, "/items/17", nil)

		assertStatus(t, response, http.StatusMethodNotAllowed)
		assertHeader(t, response, "Allow", "DELETE, GET, HEAD, PATCH, PUT")
		if body := string(bodyOf(t, response)); body != "Method Not Allowed\n" {
			t.Fatalf("body %q", body)
		}
	})
}

// rb:test errors.not_found
func TestAMissingRowIsNetHTTPs404(t *testing.T) {
	t.Run("errors.not_found", func(t *testing.T) {
		response := get(t, "/items/999999")

		assertStatus(t, response, http.StatusNotFound)
		if body := string(bodyOf(t, response)); body != "404 page not found\n" {
			t.Fatalf("body %q", body)
		}
	})
}

// rb:test errors.malformed
func TestABodyThatIsNotJSONIsRefusedWithTheDecodersMessage(t *testing.T) {
	t.Run("errors.malformed", func(t *testing.T) {
		response := postJSON(t, http.MethodPost, "/body/validate/small", []byte(`{"customerId": 1, "lines": [`))

		assertStatus(t, response, http.StatusBadRequest)
		assertJSON(t, map[string]any{"error": "unexpected EOF"}, response)
	})
}
