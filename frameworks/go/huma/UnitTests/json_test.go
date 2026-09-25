package unittests

import "testing"

// rb:test json.small,json.medium,json.large
func TestJSON(t *testing.T) {
	for _, row := range []struct{ id, path, file string }{
		{"json.small", "/json/small", "items.small.json"},
		{"json.medium", "/json/medium", "items.medium.json"},
		{"json.large", "/json/large", "items.large.json"},
	} {
		t.Run(row.id, func(t *testing.T) {
			response := client(t).Get(row.path)

			assertOK(t, payload(t, row.file), response)
			assertHeader(t, response, "Content-Type", "application/json")
		})
	}
}
