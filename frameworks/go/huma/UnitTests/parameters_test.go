package unittests

import (
	"net/http"
	"testing"
)

// rb:test parameters.static,parameters.one,parameters.two
func TestParameters(t *testing.T) {
	t.Run("parameters.static", func(t *testing.T) {
		assertOK(t, payload(t, "items.small.json"), client(t).Get("/parameters/static/segment/literal"))
	})

	t.Run("parameters.one", func(t *testing.T) {
		assertOK(t, withEcho(t, "items.small.json", map[string]any{"one": 4821.0}), client(t).Get("/parameters/4821/segment/literal"))
	})

	t.Run("parameters.two", func(t *testing.T) {
		want := withEcho(t, "items.small.json", map[string]any{"one": 4821.0, "two": 7390.0})
		assertOK(t, want, client(t).Get("/parameters/4821/with-second/7390"))
	})
}

func TestAParameterThatIsNotAnIntegerIsRefused(t *testing.T) {
	response := client(t).Get("/parameters/four/segment/literal")

	assertStatus(t, response, http.StatusUnprocessableEntity)
	assertLocations(t, response, "path.one")
}
