// baseline: dispatch floor, no serialization.
package main

import (
	hosts "github.com/ianjohnson/requestbench/targets/go/_hosts"
	"github.com/labstack/echo/v4"
)

func registerBaseline(e *echo.Echo) {
	e.GET("/plaintext", func(c echo.Context) error { return c.String(200, "Hello, World!") })

	e.GET("/health", func(c echo.Context) error { return c.String(200, "ok") })

	e.GET("/__meta", func(c echo.Context) error {
		return c.JSON(200, hosts.Meta("echo", echo.Version, "github.com/bytedance/sonic", "html/template",
			"sha1 (echo ships no conditional handling)", "echo middleware over a shared LRU"))
	})
}
