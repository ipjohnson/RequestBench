// parameters: router captures with segment depth held constant, each bound as an integer and
// echoed.
//
// Echo's own binder fills the struct: c.Bind reads the `param:` tag from the route's
// captures. The struct is both what Echo fills and what the handler echoes, so nothing copies
// one shape into another. A capture that will not parse comes back as an *echo.HTTPError
// carrying 400. The endpoint set never sends one, but it is the framework's line and not this
// file's.
//
// Echo's router prefers a literal segment to a capture, so the static route keeps its own
// request whatever order the routes are registered in.
package main

import (
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
	"github.com/labstack/echo/v4"
)

// rb:wiring parameters.*
type oneCapture struct {
	One int `param:"one" json:"one"`
}

// rb:wiring parameters.*
type twoCaptures struct {
	One int `param:"one" json:"one"`
	Two int `param:"two" json:"two"`
}

// rb:wiring parameters.*
// bindCaptures fills out from the route's captures, answering the failure itself if there is
// one, in the shape bindQuery answers a query Echo could not bind.
func bindCaptures(c echo.Context, out any) bool {
	if err := c.Bind(out); err != nil {
		_ = c.JSON(400, map[string]string{"error": "invalid_path", "detail": err.Error()})
		return false
	}
	return true
}

func registerParameters(e *echo.Echo) {
	e.GET("/parameters/static/segment/literal", payload("small"))

	e.GET("/parameters/:one/segment/literal", func(c echo.Context) error {
		var p oneCapture
		if !bindCaptures(c, &p) {
			return nil
		}
		return c.JSON(200, d.WithEcho("small", p))
	})

	e.GET("/parameters/:one/with-second/:two", func(c echo.Context) error {
		var p twoCaptures
		if !bindCaptures(c, &p) {
			return nil
		}
		return c.JSON(200, d.WithEcho("small", p))
	})
}
