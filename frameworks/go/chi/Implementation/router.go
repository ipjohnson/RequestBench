// Package implementation is the RequestBench corpus answered by chi. Each corpus family's
// routes are registered by a function of its own, in a file named for the family.
package implementation

import (
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

// Router builds every route over the payloads, on a router nothing serves yet, so the suite
// can hand it requests.
func Router(p *Payloads) (*chi.Mux, error) {
	r := chi.NewRouter()
	// Recoverer is the one layer kept of the base stack chi's README starts from. RequestID,
	// RealIP and Logger each do work on every request, and Logger writes a line for each.
	r.Use(middleware.Recoverer)

	contractRoutes(r)
	baselineRoutes(r)
	jsonRoutes(r, p)
	middlewareRoutes(r, p)
	parametersRoutes(r, p)
	queryRoutes(r, p)
	headersRoutes(r, p)
	bodyRoutes(r)
	authorizedRoutes(r, p)
	if err := cacheRoutes(r, p); err != nil {
		return nil, err
	}
	compressedRoutes(r, p)
	etagRoutes(r, p)
	templateRoutes(r, p)
	itemsRoutes(r, p)
	corsRoutes(r, p)
	formsRoutes(r, p)
	streamRoutes(r, p)
	sseRoutes(r, p)
	staticRoutes(r, p)
	return r, nil
}
