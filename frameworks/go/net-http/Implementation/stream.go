package implementation

import (
	"encoding/json"
	"net/http"
)

// streamRoutes write items.medium's rows one per line, flushing after each through net/http's
// ResponseController. The length is never known, so the answer goes out chunked.
func streamRoutes(mux *http.ServeMux, p *Payloads) {
	mux.HandleFunc("GET /stream/items", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/x-ndjson")
		flusher := http.NewResponseController(w)
		// The encoder ends each row with a newline.
		encoder := json.NewEncoder(w)
		for i := range p.Medium.Items {
			if err := encoder.Encode(&p.Medium.Items[i]); err != nil {
				return
			}
			if err := flusher.Flush(); err != nil {
				return
			}
		}
	})
}
