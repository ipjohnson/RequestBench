// json: the serializer and response buffering across three size regimes.
//
// Three static routes, not /json/:size. The size set is fixed, so a capture would make the
// router pay parameter cost on the family every other target serves from a static route,
// and it would answer 200 with an empty body for a size that does not exist.
package main

import (
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
	"github.com/labstack/echo/v4"
)

// The response is read once and served from the closure rather than looked up per request:
// the map lookup is not what any of these endpoints is measuring.
func payload(size string) echo.HandlerFunc {
	body := d.Payload(size)
	return func(c echo.Context) error { return c.JSON(200, body) }
}

func registerJSON(e *echo.Echo) {
	e.GET("/json/small", payload("small"))

	e.GET("/json/medium", payload("medium"))

	e.GET("/json/large", payload("large"))
}
