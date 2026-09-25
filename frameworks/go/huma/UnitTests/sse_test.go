package unittests

import (
	"net/http"
	"reflect"
	"strings"
	"testing"
)

// rb:test sse.medium
func TestEachRowIsTheDataOfOneMessageEvent(t *testing.T) {
	t.Run("sse.medium", func(t *testing.T) {
		response := client(t).Get("/sse/medium", "Accept: text/event-stream")

		assertStatus(t, response, http.StatusOK)
		if kind := response.Header().Get("Content-Type"); !strings.HasPrefix(kind, "text/event-stream") {
			t.Fatalf("content type %q", kind)
		}
		assertNoHeader(t, response, "Content-Length")
		events := strings.Split(strings.TrimSuffix(response.Body.String(), "\n\n"), "\n\n")
		rows := payload(t, "items.medium.json").(map[string]any)["items"].([]any)
		if len(events) != len(rows) {
			t.Fatalf("%d events, want %d", len(events), len(rows))
		}
		for i, event := range events {
			// An event with no event field is dispatched as a message.
			data, found := strings.CutPrefix(event, "data: ")
			if !found || strings.Contains(data, "\n") {
				t.Fatalf("event %d is %q", i+1, event)
			}
			if !reflect.DeepEqual(parsed(t, []byte(data)), rows[i]) {
				t.Fatalf("event %d carries %s", i+1, data)
			}
		}
	})
}
