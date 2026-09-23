package implementation

import (
	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"
)

// corsRoutes put Echo's CORS middleware on the /cors group and nowhere else. A group with
// middleware registers a 404 route for its own prefix, so a preflight to a path the group routes
// reaches the middleware with no OPTIONS route, and the middleware answers it before any handler
// runs. The handler writes x-rb-serial, so its absence on a preflight shows the middleware
// answered alone.
func corsRoutes(e *echo.Echo, p *Payloads) {
	policy := p.Settings.Cors
	// rb:wiring cors.*
	group := e.Group("/cors", middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{policy.Origin},
		AllowMethods: []string{policy.Method},
		AllowHeaders: []string{policy.Header},
		MaxAge:       policy.MaxAgeSeconds,
	}))

	// rb:handler cors.request
	group.GET("/small", fresh(&p.Small))
}
