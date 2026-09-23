package implementation

import (
	"net/http"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
)

// corsRoutes put gorilla/handlers' CORS middleware on the /cors subrouter and nowhere else. It
// answers a preflight before the handler runs. The handler writes x-rb-serial, so its absence on
// a preflight shows the middleware answered alone.
func corsRoutes(r *mux.Router, p *Payloads) {
	policy := p.Settings.Cors
	crossOrigin := r.PathPrefix("/cors").Subrouter()
	// rb:wiring cors.*
	crossOrigin.Use(handlers.CORS(
		handlers.AllowedOrigins([]string{policy.Origin}),
		handlers.AllowedMethods([]string{policy.Method}),
		handlers.AllowedHeaders([]string{policy.Header}),
		handlers.MaxAge(policy.MaxAgeSeconds),
	))

	// mux runs a subrouter's middlewares only for a request one of its routes matched, so the
	// route names OPTIONS beside GET for the preflight to reach the middleware.
	// rb:handler cors.request
	crossOrigin.HandleFunc("/small", fresh(&p.Small)).Methods(http.MethodGet, http.MethodOptions)
}
