// middleware: per-layer dispatch cost at 0, 4 and 16 no-op layers.
//
// Echo takes middleware as trailing arguments on the route, which is the scoping the
// family needs. Each layer calls the next and does nothing else.
package main

import "github.com/labstack/echo/v4"

// rb:wiring middleware.*
func noop(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error { return next(c) }
}

// rb:wiring middleware.*
func layers(n int) []echo.MiddlewareFunc {
	out := make([]echo.MiddlewareFunc, n)
	for i := range out {
		out[i] = noop
	}
	return out
}

func registerMiddleware(e *echo.Echo) {
	e.GET("/middleware/none", payload("small"))

	e.GET("/middleware/four", payload("small"), layers(4)...)

	e.GET("/middleware/sixteen", payload("small"), layers(16)...)
}
