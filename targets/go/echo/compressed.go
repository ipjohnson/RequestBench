// compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
//
// Echo's own gzip middleware, attached to these three routes alone. On the instance it
// would put a "did the client ask?" check on all forty-five endpoints and contaminate the
// rows this family is measured against, which is why they have their own paths instead of
// riding on /json with an accept-encoding header.
package main

import (
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// Level is pinned across every language. The size threshold is left at the library's own
// default, because whether a framework bothers to compress a body too small to benefit is
// what compressed.gzip_small is in the set to show.
var gzip = middleware.GzipWithConfig(middleware.GzipConfig{Level: d.GzipLevel})

func compressedRoute(size string) echo.HandlerFunc {
	body := d.Payload(size)
	return func(c echo.Context) error {
		c.Response().Header().Set("x-rb-serial", d.NextSerial())
		return c.JSON(200, body)
	}
}

func registerCompressed(e *echo.Echo) {
	// rb:snippet compressed.identity_small compressed.identity_medium compressed.identity_large
	// rb:snippet compressed.gzip_small compressed.gzip_medium compressed.gzip_large
	for _, size := range []string{"small", "medium", "large"} {
		e.GET("/compressed/"+size, compressedRoute(size), gzip)
	}
}
