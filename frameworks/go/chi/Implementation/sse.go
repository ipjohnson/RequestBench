package implementation

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
)

// sseRoutes send items.medium's rows as server-sent events, written by hand. chi has no event
// stream of its own, and render's gives every event the type data, where an EventSource
// dispatches message. Each row is one event with the row's JSON as its data, flushed as it is
// written.
func sseRoutes(r chi.Router, p *Payloads) {
	r.Get("/sse/medium", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		flusher := http.NewResponseController(w)
		for i := range p.Medium.Items {
			data, err := json.Marshal(&p.Medium.Items[i])
			if err != nil {
				return
			}
			if _, err := fmt.Fprintf(w, "data: %s\n\n", data); err != nil {
				return
			}
			if err := flusher.Flush(); err != nil {
				return
			}
		}
	})
}
