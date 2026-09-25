package implementation

import (
	"io"
	"net/http"
)

// baselineRoutes is the dispatch floor, with nothing serialised.
func baselineRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /plaintext", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		_, _ = io.WriteString(w, "Hello, World!")
	})
}
