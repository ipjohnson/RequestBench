package implementation

import (
	"compress/gzip"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

// compressedRoutes answer like any other. chi's Compress middleware, on these two routes alone,
// gzips an answer whose Content-Type it lists when the request asks for gzip, at the fastest
// level every framework here compresses at.
func compressedRoutes(r chi.Router, p *Payloads) {
	// rb:wiring compressed.*
	compress := middleware.Compress(gzip.BestSpeed)

	r.With(compress).Get("/compressed/small", fresh(&p.Small))

	r.With(compress).Get("/compressed/large", fresh(&p.Large))
}
