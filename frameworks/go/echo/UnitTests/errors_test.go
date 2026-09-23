package unittests

import (
	"net/http"
	"testing"
)

// rb:test errors.unmatched
func TestAPathNoRouteMatchesIsEchosNotFound(t *testing.T) {
	t.Run("errors.unmatched", func(t *testing.T) {
		response := get(t, "/errors/unmatched")

		assertStatus(t, response, http.StatusNotFound)
		assertJSON(t, map[string]any{"message": "Not Found"}, response)
	})
}

// rb:test errors.wrong_method
func TestAMethodThePathHasNoRouteForIs405WithTheMethodsItHas(t *testing.T) {
	t.Run("errors.wrong_method", func(t *testing.T) {
		response := send(t, http.MethodPost, "/items/17", nil)

		assertStatus(t, response, http.StatusMethodNotAllowed)
		assertHeader(t, response, "Allow", "OPTIONS, DELETE, GET, HEAD, PATCH, PUT")
		assertJSON(t, map[string]any{"message": "Method Not Allowed"}, response)
	})
}

// rb:test errors.not_found
func TestAMissingRowIsEchosNotFound(t *testing.T) {
	t.Run("errors.not_found", func(t *testing.T) {
		response := get(t, "/items/999999")

		assertStatus(t, response, http.StatusNotFound)
		assertJSON(t, map[string]any{"message": "Not Found"}, response)
	})
}

// rb:test errors.malformed
func TestABodyThatIsNotJSONIsABadRequestThatNamesNothing(t *testing.T) {
	t.Run("errors.malformed", func(t *testing.T) {
		response := postJSON(t, http.MethodPost, "/body/validate/small", []byte(`{"customerId": 1, "lines": [`))

		assertStatus(t, response, http.StatusBadRequest)
		assertJSON(t, map[string]any{"message": "Bad Request"}, response)
	})
}
