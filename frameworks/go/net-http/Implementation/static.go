package implementation

import (
	"net/http"
	"os"
)

// staticRoutes serve the payload directory with net/http's file server, under a pattern that
// matches everything below /static/.
func staticRoutes(mux *http.ServeMux, p *Payloads) {
	// rb:handler static.file
	mux.Handle("GET /static/", http.StripPrefix("/static/", http.FileServerFS(os.DirFS(p.Directory))))
}
