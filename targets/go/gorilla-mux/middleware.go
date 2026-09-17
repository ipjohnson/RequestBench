// middleware: per-layer dispatch cost at 0, 4 and 16 no-op layers.
//
// Each layer calls the next and does nothing else. mux.Use applies to a whole router, so
// the layers are chained onto the one handler that asked for them.
package main

import (
	"net/http"

	"github.com/gorilla/mux"
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

func registerMiddleware(r *mux.Router) {
	r.Handle("/middleware/none", payload("small")).Methods("GET")

	r.Handle("/middleware/four", chain(payload("small"), layers(4)...)).Methods("GET")

	r.Handle("/middleware/sixteen", chain(payload("small"), layers(16)...)).Methods("GET")
}
