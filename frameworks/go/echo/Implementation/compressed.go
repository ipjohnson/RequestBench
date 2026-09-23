package implementation

import (
	"compress/gzip"

	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"
)

// compressedRoutes answer like any other. Echo's Gzip middleware, on these two routes alone,
// gzips the answer when the request asks for gzip, at the fastest level every framework here
// compresses at.
func compressedRoutes(e *echo.Echo, p *Payloads) {
	// rb:wiring compressed.*
	compress := middleware.GzipWithConfig(middleware.GzipConfig{Level: gzip.BestSpeed})

	e.GET("/compressed/small", fresh(&p.Small), compress)

	e.GET("/compressed/large", fresh(&p.Large), compress)
}
