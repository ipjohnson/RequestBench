// authorized: the framework's authorization mechanism, crypto excluded.
//
// Route-scoped middleware, not an if in the handler. An if would measure the language;
// the point of the family is the framework's own plumbing.
package main

import (
	"github.com/labstack/echo/v4"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

func requireToken(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		if !d.TokenOK(c.Request().Header.Get("authorization")) {
			return c.JSON(403, d.ForbiddenBody())
		}
		return next(c)
	}
}

func registerAuthorized(e *echo.Echo) {
	e.GET("/authorized/small", payload("small"), requireToken)
}
