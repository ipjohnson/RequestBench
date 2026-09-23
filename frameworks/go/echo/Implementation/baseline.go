package implementation

import (
	"net/http"

	"github.com/labstack/echo/v5"
)

// baselineRoutes is the dispatch floor, with nothing serialised.
func baselineRoutes(e *echo.Echo) {
	e.GET("/plaintext", func(c *echo.Context) error { return c.String(http.StatusOK, "Hello, World!") })
}
