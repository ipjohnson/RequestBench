package unittests

import "testing"

// rb:test middleware.none,middleware.four,middleware.sixteen
func TestMiddleware(t *testing.T) {
	for _, row := range []struct{ id, path string }{
		{"middleware.none", "/middleware/none"},
		{"middleware.four", "/middleware/four"},
		{"middleware.sixteen", "/middleware/sixteen"},
	} {
		t.Run(row.id, func(t *testing.T) {
			assertOK(t, payload(t, "items.small.json"), client(t).Get(row.path))
		})
	}
}
