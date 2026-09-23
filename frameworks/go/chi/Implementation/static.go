package implementation

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// staticRoutes serve the payload directory with net/http's FileServer on a wildcard route, as
// chi's fileserver example does. chi has no file server of its own.
func staticRoutes(r chi.Router, p *Payloads) {
	files := http.StripPrefix("/static", http.FileServer(http.Dir(p.Directory)))

	// rb:handler static.file
	r.Get("/static/*", files.ServeHTTP)
}
