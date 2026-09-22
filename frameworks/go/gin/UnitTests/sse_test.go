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
		response := get(t, "/sse/medium", "Accept", "text/event-stream")

		assertStatus(t, response, http.StatusOK)
		if kind := response.Header.Get("Content-Type"); !strings.HasPrefix(kind, "text/event-stream") {
			t.Fatalf("content type %q", kind)
		}
		if response.ContentLength != -1 {
			t.Fatalf("content length %d, which a stream cannot know", response.ContentLength)
		}
		events := strings.Split(strings.TrimSuffix(string(bodyOf(t, response)), "\n\n"), "\n\n")
		rows := payload(t, "items.medium.json").(map[string]any)["items"].([]any)
		if len(events) != len(rows) {
			t.Fatalf("%d events, want %d", len(events), len(rows))
		}
		for i, event := range events {
			kind, data, found := strings.Cut(event, "\n")
			if !found || kind != "event:message" || !strings.HasPrefix(data, "data:") {
				t.Fatalf("event %d is %q", i+1, event)
			}
			if !reflect.DeepEqual(parsed(t, []byte(strings.TrimPrefix(data, "data:"))), rows[i]) {
				t.Fatalf("event %d carries %s", i+1, data)
			}
		}
	})
}
