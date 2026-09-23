package implementation

import (
	"net/http"

	"github.com/gorilla/mux"
)

// staticRoutes serve the payload directory with net/http's FileServer under a path prefix,
// exactly as mux's README serves static files. mux has no file server of its own.
func staticRoutes(r *mux.Router, p *Payloads) {
	// rb:handler static.file
	r.PathPrefix("/static/").Handler(http.StripPrefix("/static/", http.FileServer(http.Dir(p.Directory))))
}
