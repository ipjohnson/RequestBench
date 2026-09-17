// middleware: per-layer dispatch cost at 0, 4 and 16 no-op layers.
//
// chi's r.With returns a router carrying those middlewares and nothing else, which is the
// scoping the family needs. Each layer calls the next and does nothing else.
package main

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// rb:wiring middleware.*
func noop(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		next.ServeHTTP(w, req)
	})
}

// rb:wiring middleware.*
func layers(n int) []func(http.Handler) http.Handler {
	out := make([]func(http.Handler) http.Handler, n)
	for i := range out {
		out[i] = noop
	}
	return out
}

func registerMiddleware(r chi.Router) {
	r.Get("/middleware/none", payload("small"))

	r.With(layers(4)...).Get("/middleware/four", payload("small"))

	r.With(layers(16)...).Get("/middleware/sixteen", payload("small"))
}
