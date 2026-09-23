// Package implementation is the RequestBench corpus answered by gorilla/mux. Each corpus
// family's routes are registered by a function of its own, in a file named for the family.
package implementation

import (
	"net/http"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
)

// Router builds every route over the payloads, on a router nothing serves yet, so the suite
// can hand it requests. mux tries routes in the order they are registered.
func Router(p *Payloads) http.Handler {
	r := mux.NewRouter()

	contractRoutes(r)
	baselineRoutes(r)
	jsonRoutes(r, p)
	middlewareRoutes(r, p)
	parametersRoutes(r, p)
	queryRoutes(r, p)
	headersRoutes(r, p)
	bodyRoutes(r)
	authorizedRoutes(r, p)
	cacheRoutes(r, p)
	compressedRoutes(r, p)
	etagRoutes(r, p)
	templateRoutes(r, p)
	itemsRoutes(r, p)
	corsRoutes(r, p)
	formsRoutes(r, p)
	streamRoutes(r, p)
	sseRoutes(r, p)
	staticRoutes(r, p)

	// Wrapped whole in gorilla/handlers' recoverer, as its documentation wraps a router.
	return handlers.RecoveryHandler()(r)
}
