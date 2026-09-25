package unittests

import (
	"net/http"
	"reflect"
	"strings"
	"testing"
)

// rb:test stream.ndjson
func TestTheRowsGoOutOnePerLine(t *testing.T) {
	t.Run("stream.ndjson", func(t *testing.T) {
		response := client(t).Get("/stream/items")

		assertStatus(t, response, http.StatusOK)
		assertHeader(t, response, "Content-Type", "application/x-ndjson")
		assertNoHeader(t, response, "Content-Length")
		lines := strings.Split(strings.TrimSuffix(response.Body.String(), "\n"), "\n")
		rows := payload(t, "items.medium.json").(map[string]any)["items"].([]any)
		if len(lines) != len(rows) {
			t.Fatalf("%d lines, want %d", len(lines), len(rows))
		}
		for i, line := range lines {
			if !reflect.DeepEqual(parsed(t, []byte(line)), rows[i]) {
				t.Fatalf("line %d is %s", i+1, line)
			}
		}
	})
}
