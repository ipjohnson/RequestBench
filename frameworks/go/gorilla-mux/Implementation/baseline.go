package implementation

import (
	"io"
	"net/http"

	"github.com/gorilla/mux"
)

// baselineRoutes is the dispatch floor, with nothing serialised.
func baselineRoutes(r *mux.Router) {
	r.HandleFunc("/plaintext", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		_, _ = io.WriteString(w, "Hello, World!")
	}).Methods(http.MethodGet)
}
