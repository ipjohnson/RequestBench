package unittests

import (
	"net/http"
	"strings"
	"testing"
)

// rb:test errors.unmatched
func TestAPathNoRouteMatchesIsFibersNotFound(t *testing.T) {
	t.Run("errors.unmatched", func(t *testing.T) {
		response := get(t, "/errors/unmatched")

		assertStatus(t, response, http.StatusNotFound)
		assertText(t, response, "Not Found")
	})
}

// rb:test errors.wrong_method
func TestAMethodThePathHasNoRouteForIs405WithTheMethodsItHas(t *testing.T) {
	t.Run("errors.wrong_method", func(t *testing.T) {
		response := send(t, http.MethodPost, "/items/17", nil)

		assertStatus(t, response, http.StatusMethodNotAllowed)
		if allow := response.Header.Get("Allow"); !strings.Contains(allow, "GET") || strings.Contains(allow, "POST") {
			t.Fatalf("allow %q", allow)
		}
		assertText(t, response, "Method Not Allowed")
	})
}

// rb:test errors.not_found
func TestAMissingRowIsFibersNotFound(t *testing.T) {
	t.Run("errors.not_found", func(t *testing.T) {
		response := get(t, "/items/999999")

		assertStatus(t, response, http.StatusNotFound)
		assertText(t, response, "Not Found")
	})
}

// rb:test errors.malformed
func TestABodyThatIsNotJSONReachesTheErrorHandlerAs500(t *testing.T) {
	t.Run("errors.malformed", func(t *testing.T) {
		response := postJSON(t, http.MethodPost, "/body/validate/small", []byte(`{"customerId": 1, "lines": [`))

		assertStatus(t, response, http.StatusInternalServerError)
		assertText(t, response, "bind from body: unexpected end of JSON input")
	})
}

// assertText checks for a text/plain answer with exactly this body, as Fiber's default error
// handler writes one.
func assertText(t *testing.T, response *http.Response, want string) {
	t.Helper()
	if kind := response.Header.Get("Content-Type"); !strings.HasPrefix(kind, "text/plain") {
		t.Fatalf("content type %q", kind)
	}
	if body := string(bodyOf(t, response)); body != want {
		t.Fatalf("body %q, want %q", body, want)
	}
}
