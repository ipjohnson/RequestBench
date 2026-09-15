// query: query string parsing and coercion, isolated from any use of the values.
//
// Echo parses c.QueryParams(), which is the work this family measures; the domain coerces
// what it parsed, so every target in the language answers the same values.
package main

import (
	"github.com/labstack/echo/v4"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

func registerQuery(e *echo.Echo) {
	e.GET("/query/one", func(c echo.Context) error {
		return c.JSON(200, d.CoerceOne(c.QueryParams()))
	})

	e.GET("/query/many", func(c echo.Context) error {
		return c.JSON(200, d.CoerceMany(c.QueryParams()))
	})
}
