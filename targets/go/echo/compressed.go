// compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
//
// Echo's own gzip middleware, attached to these three routes alone. On the instance it
// would put a "did the client ask?" check on all forty-five endpoints and contaminate the
// rows this family is measured against, which is why they have their own paths instead of
// riding on /json with an accept-encoding header.
package main

import (
	"compress/flate"

	d "github.com/ianjohnson/requestbench/targets/go/_shared"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

// The size threshold is left at the library's own default, because whether a framework
// bothers to compress a body too small to benefit is what compressed.gzip_small is in the
// set to show.
// rb:wiring compressed.*
var gzip = middleware.GzipWithConfig(middleware.GzipConfig{Level: flate.BestSpeed})

// rb:wiring compressed.*
func compressedRoute(size string) echo.HandlerFunc {
	body := d.Payload(size)
	return func(c echo.Context) error {
		c.Response().Header().Set("x-rb-serial", d.NextSerial())
		return c.JSON(200, body)
	}
}

func registerCompressed(e *echo.Echo) {
	// rb:handler compressed.*
	for _, size := range []string{"small", "medium", "large"} {
		e.GET("/compressed/"+size, compressedRoute(size), gzip)
	}
}
