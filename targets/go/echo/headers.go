// headers: eager against lazy construction of the request header map.
//
// The handler reads no header at all, so headers.many minus headers.few is the cost of
// materialising 27 nobody asked for.
package main

import "github.com/labstack/echo/v4"

func registerHeaders(e *echo.Echo) {
	e.GET("/headers", payload("small"))
}
