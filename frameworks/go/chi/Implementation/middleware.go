package implementation

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

// middlewareRoutes put no-op layers in front of the handler. r.With builds an inline router
// whose middlewares wrap the one route registered on it, so these layers are on these two
// routes alone.
func middlewareRoutes(r chi.Router, p *Payloads) {
	small := func(w http.ResponseWriter, r *http.Request) { render.JSON(w, r, &p.Small) }

	r.Get("/middleware/none", small)

	r.With(layered(4)...).Get("/middleware/four", small)

	r.With(layered(16)...).Get("/middleware/sixteen", small)
}

// rb:wiring middleware.*
// noop is one layer: it calls the next handler and does nothing else.
func noop(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { next.ServeHTTP(w, r) })
}

// layered is count no-op layers, as the middlewares r.With takes.
func layered(count int) []func(http.Handler) http.Handler {
	layers := make([]func(http.Handler) http.Handler, count)
	for i := range layers {
		layers[i] = noop
	}
	return layers
}

// rb:end
