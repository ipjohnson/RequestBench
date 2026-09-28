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
	r.Route("/cors", func(r chi.Router) {
		// rb:wiring cors.*
		r.Use(cors.Handler(cors.Options{
			AllowedOrigins: []string{"https://shop.example.com"},
			AllowedMethods: []string{"GET"},
			AllowedHeaders: []string{"x-rb-tenant"},
			MaxAge:         600,
		}))

		// rb:handler cors.request
		r.Get("/small", fresh(&p.Small))
	})
}
