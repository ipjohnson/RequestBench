package implementation

import (
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
)

// corsRoutes put Fiber's cors middleware on the /cors group and nowhere else. Fiber answers a
// path with no route for the request's method before any middleware runs, except for a
// preflight, so the group's middleware answers a preflight with no OPTIONS route. The handler
// writes x-rb-serial, so its absence on a preflight shows the middleware answered alone.
func corsRoutes(app *fiber.App, p *Payloads) {
	policy := p.Settings.Cors
	// rb:wiring cors.*
	group := app.Group("/cors", cors.New(cors.Config{
		AllowOrigins: []string{policy.Origin},
		AllowMethods: []string{policy.Method},
		AllowHeaders: []string{policy.Header},
		MaxAge:       policy.MaxAgeSeconds,
	}))
	// rb:end

	// rb:handler cors.request
	group.Get("/small", fresh(&p.Small))
}
