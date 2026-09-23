package unittests

import (
	"net/http"
	"strings"
	"testing"
)

// row is row id of items.large, parsed.
func row(t *testing.T, id int) map[string]any {
	t.Helper()
	return payload(t, "items.large.json").(map[string]any)["items"].([]any)[id-1].(map[string]any)
}

// rb:test items.read,items.head,items.create,items.replace,items.update,items.delete
func TestItems(t *testing.T) {
	t.Run("items.read", func(t *testing.T) {
		assertOK(t, row(t, 17), get(t, "/items/17"))
	})

	t.Run("items.head", func(t *testing.T) {
		response := send(t, http.MethodHead, "/items/17", nil)

		assertStatus(t, response, http.StatusOK)
		if kind := response.Header.Get("Content-Type"); !strings.HasPrefix(kind, "application/json") {
			t.Fatalf("content type %q", kind)
		}
		if body := bodyOf(t, response); len(body) != 0 {
			t.Fatalf("a HEAD answer with %d bytes", len(body))
		}
	})

	t.Run("items.create", func(t *testing.T) {
		response := postJSON(t, http.MethodPost, "/items", file(t, "items.new.json"))

		assertStatus(t, response, http.StatusCreated)
		assertHeader(t, response, "Location", "/items/1426")
		created := payload(t, "items.new.json").(map[string]any)
		created["id"] = 1426.0
		assertJSON(t, created, response)
	})

	t.Run("items.replace", func(t *testing.T) {
		replaced := payload(t, "items.new.json").(map[string]any)
		replaced["id"] = 17.0

		assertOK(t, replaced, postJSON(t, http.MethodPut, "/items/17", file(t, "items.new.json")))
	})

	t.Run("items.update", func(t *testing.T) {
		patched := row(t, 17)
		for name, value := range payload(t, "items.patch.json").(map[string]any) {
			patched[name] = value
		}

		assertOK(t, patched, postJSON(t, http.MethodPatch, "/items/17", file(t, "items.patch.json")))
	})

	t.Run("items.delete", func(t *testing.T) {
		response := send(t, http.MethodDelete, "/items/17", nil)

		assertStatus(t, response, http.StatusNoContent)
		if body := bodyOf(t, response); len(body) != 0 {
			t.Fatalf("a 204 with %d bytes", len(body))
		}
	})
}

func TestAMissingRowIsNotUpdatedOrDeleted(t *testing.T) {
	assertStatus(t, postJSON(t, http.MethodPatch, "/items/999999", file(t, "items.patch.json")), http.StatusNotFound)
	assertStatus(t, send(t, http.MethodDelete, "/items/999999", nil), http.StatusNotFound)
}
