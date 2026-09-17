// baseline: dispatch floor, no serialization.
package main

import (
	"github.com/labstack/echo/v4"
	hosts "github.com/ianjohnson/requestbench/targets/go/_hosts"
)

func registerBaseline(e *echo.Echo) {
	e.GET("/plaintext", func(c echo.Context) error { return c.String(200, "Hello, World!") })

	e.GET("/health", func(c echo.Context) error { return c.String(200, "ok") })

	e.GET("/__meta", func(c echo.Context) error { return c.JSON(200, hosts.Meta("echo", echo.Version, "html/template")) })
}
