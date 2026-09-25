package implementation

import "net/http"

// middlewareRoutes put no-op layers in front of the handler. A layer in net/http is a function
// from one http.Handler to another, so the chain is built once, when the route is registered.
func middlewareRoutes(mux *http.ServeMux, p *Payloads) {
	small := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { respond(w, http.StatusOK, &p.Small) })

	mux.Handle("GET /middleware/none", small)

	mux.Handle("GET /middleware/four", layered(4, small))

	mux.Handle("GET /middleware/sixteen", layered(16, small))
}

// rb:wiring middleware.*
// noop is one layer: it calls the next handler and does nothing else.
func noop(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { next.ServeHTTP(w, r) })
}

// layered wraps count no-op layers around a handler.
func layered(count int, handler http.Handler) http.Handler {
	for range count {
		handler = noop(handler)
	}
	return handler
}

// rb:end
