// cached: validator headers and the conditional request.
//
// The ETag is pinned in the fixture, so this measures emitting the header and comparing it
// rather than hashing the body. The size is closed over rather than read back out of the
// path, and the comparison requires a non-empty header: matching a missing if-none-match
// against an empty ETag answers 304 to a client that never asked a conditional question.
package main

import (
	"github.com/labstack/echo/v4"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

func validatorsFor(size string) echo.MiddlewareFunc {
	etag := d.ETagOf(size)
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			h := c.Response().Header()
			h.Set("etag", etag)
			h.Set("cache-control", d.Cacheable)
			h.Set("x-rb-serial", d.NextSerial())
			if inm := c.Request().Header.Get("if-none-match"); inm != "" && inm == etag {
				return c.NoContent(304)
			}
			return next(c)
		}
	}
}

func registerCached(e *echo.Echo) {
	// rb:snippet cached.small cached.medium cached.large cached.revalidate
	for _, size := range []string{"small", "medium", "large"} {
		e.GET("/cached/"+size, payload(size), validatorsFor(size))
	}
}
