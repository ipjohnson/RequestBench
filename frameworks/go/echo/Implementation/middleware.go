package implementation

import (
	"net/http"

	"github.com/labstack/echo/v5"
)

// middlewareRoutes put no-op layers in front of the handler. Echo takes a route's own
// middlewares after its handler and wraps them around it once, when the route is added, so these
// layers are on these two routes alone.
func middlewareRoutes(e *echo.Echo, p *Payloads) {
	small := func(c *echo.Context) error { return c.JSON(http.StatusOK, &p.Small) }

	e.GET("/middleware/none", small)

	e.GET("/middleware/four", small, layered(4)...)

	e.GET("/middleware/sixteen", small, layered(16)...)
}

// rb:wiring middleware.*
// noop is one layer: it calls the next handler and does nothing else.
func noop(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c *echo.Context) error { return next(c) }
}

// layered is count no-op layers, as a route's middlewares.
func layered(count int) []echo.MiddlewareFunc {
	layers := make([]echo.MiddlewareFunc, count)
	for i := range layers {
		layers[i] = noop
	}
	return layers
}

// rb:end
