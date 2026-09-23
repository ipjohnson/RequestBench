package implementation

import (
	"net/http"

	"github.com/gorilla/mux"
)

// middlewareRoutes put no-op layers in front of the handler. A mux middleware belongs to a
// router and runs for every request one of the router's routes matches, so each layered route
// is a subrouter of its own path.
func middlewareRoutes(r *mux.Router, p *Payloads) {
	small := func(w http.ResponseWriter, r *http.Request) { respond(w, http.StatusOK, &p.Small) }

	r.HandleFunc("/middleware/none", small).Methods(http.MethodGet)

	// rb:handler middleware.four
	four := r.Path("/middleware/four").Subrouter()
	four.Use(layered(4)...)
	four.Methods(http.MethodGet).HandlerFunc(small)
	// rb:end

	// rb:handler middleware.sixteen
	sixteen := r.Path("/middleware/sixteen").Subrouter()
	sixteen.Use(layered(16)...)
	sixteen.Methods(http.MethodGet).HandlerFunc(small)
	// rb:end
}

// rb:wiring middleware.*
// noop is one layer: it calls the next handler and does nothing else.
func noop(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { next.ServeHTTP(w, r) })
}

// layered is count no-op layers. mux wraps a router's layers around the matched handler on
// every request.
func layered(count int) []mux.MiddlewareFunc {
	layers := make([]mux.MiddlewareFunc, count)
	for i := range layers {
		layers[i] = noop
	}
	return layers
}

// rb:end
