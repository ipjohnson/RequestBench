// Package implementation is the RequestBench corpus answered by Echo. Each corpus family's
// routes are registered by a function of its own, in a file named for the family.
package implementation

import (
	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"
)

// Router builds every route over the payloads, on an instance nothing serves yet, so the suite
// can hand it requests.
func Router(p *Payloads) *echo.Echo {
	e := echo.New()
	// The stack Echo's README starts from without its request logger, which writes a line for
	// every request.
	e.Use(middleware.Recover())

	contractRoutes(e)
	baselineRoutes(e)
	jsonRoutes(e, p)
	middlewareRoutes(e, p)
	parametersRoutes(e, p)
	queryRoutes(e, p)
	headersRoutes(e, p)
	bodyRoutes(e)
	authorizedRoutes(e, p)
	cacheRoutes(e, p)
	compressedRoutes(e, p)
	etagRoutes(e, p)
	templateRoutes(e, p)
	itemsRoutes(e, p)
	corsRoutes(e, p)
	formsRoutes(e, p)
	streamRoutes(e, p)
	sseRoutes(e, p)
	staticRoutes(e, p)
	return e
}
