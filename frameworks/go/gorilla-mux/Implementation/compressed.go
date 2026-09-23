package implementation

import (
	"compress/gzip"
	"net/http"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
)

// compressedRoutes answer like any other. gorilla/handlers' compressor, on the /compressed
// subrouter alone, gzips the answer when the request asks for gzip, at the fastest level every
// framework here compresses at.
func compressedRoutes(r *mux.Router, p *Payloads) {
	compressed := r.PathPrefix("/compressed").Subrouter()
	// rb:wiring compressed.*
	compressed.Use(func(next http.Handler) http.Handler { return handlers.CompressHandlerLevel(next, gzip.BestSpeed) })

	// rb:handler compressed.gzip_small,compressed.identity_small
	compressed.HandleFunc("/small", fresh(&p.Small)).Methods(http.MethodGet)

	// rb:handler compressed.gzip_large,compressed.identity_large
	compressed.HandleFunc("/large", fresh(&p.Large)).Methods(http.MethodGet)
}
