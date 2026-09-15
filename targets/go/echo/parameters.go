// parameters: router captures with segment depth held constant.
package main

import "github.com/labstack/echo/v4"

func registerParameters(e *echo.Echo) {
	e.GET("/parameters/static/segment/literal", payload("small"))

	e.GET("/parameters/:one", payload("small"))

	e.GET("/parameters/:one/with-second/:two", payload("small"))
}
