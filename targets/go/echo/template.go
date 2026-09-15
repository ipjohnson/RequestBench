// template: server-side rendering of the same model the json family serializes.
//
// The engine is html/template, shared with every other Go target and named on /__meta.
// Echo's Renderer interface would reach the same parsed template through one more
// indirection; the engine is pinned for the same reason the gzip level is.
package main

import (
	"github.com/labstack/echo/v4"
	hosts "github.com/ianjohnson/requestbench/targets/go/_hosts"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

func templateRoute(size string) echo.HandlerFunc {
	body := d.Payload(size)
	return func(c echo.Context) error { return c.HTML(200, hosts.RenderItems(body)) }
}

func registerTemplate(e *echo.Echo) {
	e.GET("/template/small", templateRoute("small"))

	e.GET("/template/medium", templateRoute("medium"))
}
