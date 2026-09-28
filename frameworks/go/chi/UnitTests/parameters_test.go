package unittests

import "testing"

// rb:test parameters.static,parameters.one,parameters.two,parameters.three
func TestParameters(t *testing.T) {
	t.Run("parameters.static", func(t *testing.T) {
		assertOK(t, payload(t, "items.small.json"), get(t, "/parameters/static/segment/literal"))
	})

	t.Run("parameters.one", func(t *testing.T) {
		assertOK(t, withEcho(t, "items.small.json", map[string]any{"one": 4821.0}), get(t, "/parameters/4821/segment/literal"))
	})

	t.Run("parameters.two", func(t *testing.T) {
		want := withEcho(t, "items.small.json", map[string]any{"one": 4821.0, "two": 7390.0})
		assertOK(t, want, get(t, "/parameters/4821/with-second/7390"))
	})

	t.Run("parameters.three", func(t *testing.T) {
		want := withEcho(t, "items.small.json", map[string]any{"one": 4821.0, "two": 7390.0, "three": 1563.0})
		assertOK(t, want, get(t, "/parameters/4821/7390/1563"))
	})
}

func TestACaptureThatIsNotAnIntegerIsRefused(t *testing.T) {
	assertStatus(t, get(t, "/parameters/four/segment/literal"), 400)
}
