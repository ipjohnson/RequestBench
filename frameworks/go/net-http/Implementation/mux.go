// Package implementation is the RequestBench corpus answered by the standard library's net/http
// and nothing else. Each corpus family's routes are registered by a function of its own, in a
// file named for the family.
package implementation

import "net/http"

// Mux registers every route over the payloads on a ServeMux nothing serves yet, so the suite can
// hand it requests. A ServeMux answers with the most specific pattern that matches, whatever
// order the patterns were registered in.
func Mux(p *Payloads) *http.ServeMux {
	mux := http.NewServeMux()

	contractRoutes(mux)
	baselineRoutes(mux)
	jsonRoutes(mux, p)
	middlewareRoutes(mux, p)
	parametersRoutes(mux, p)
	queryRoutes(mux, p)
	headersRoutes(mux, p)
	bodyRoutes(mux)
	authorizedRoutes(mux, p)
	cacheRoutes(mux, p)
	compressedRoutes(mux, p)
	etagRoutes(mux, p)
	templateRoutes(mux, p)
	itemsRoutes(mux, p)
	corsRoutes(mux, p)
	formsRoutes(mux, p)
	streamRoutes(mux, p)
	sseRoutes(mux, p)
	staticRoutes(mux, p)

	return mux
}
