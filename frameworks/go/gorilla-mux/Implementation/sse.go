package implementation

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gorilla/mux"
)

// sseRoutes send items.medium's rows as server-sent events, written by hand, because mux and the
// gorilla toolkit have no event stream. Each row is one event with the row's JSON as its data,
// flushed as it is written.
func sseRoutes(r *mux.Router, p *Payloads) {
	r.HandleFunc("/sse/medium", func(w http.ResponseWriter, r *http.Request) {
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
	}).Methods(http.MethodGet)
}
