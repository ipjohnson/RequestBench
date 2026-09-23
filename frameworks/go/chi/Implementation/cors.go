package implementation

import (
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
)

// corsRoutes put go-chi/cors on the /cors subrouter and nowhere else. A subrouter's
// middlewares run before it routes, so the middleware answers a preflight with no OPTIONS
// route and before any handler runs. The handler writes x-rb-serial, so its absence on a
// preflight shows the middleware answered alone.
func corsRoutes(r chi.Router, p *Payloads) {
	policy := p.Settings.Cors
	r.Route("/cors", func(r chi.Router) {
		// rb:wiring cors.*
		r.Use(cors.Handler(cors.Options{
			AllowedOrigins: []string{policy.Origin},
			AllowedMethods: []string{policy.Method},
			AllowedHeaders: []string{policy.Header},
			MaxAge:         policy.MaxAgeSeconds,
		}))

		// rb:handler cors.request
		r.Get("/small", fresh(&p.Small))
	})
}
