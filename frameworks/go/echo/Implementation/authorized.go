package implementation

import (
	"net/http"

	"github.com/labstack/echo/v5"
)

// authorizedRoutes put a middleware in front of the handler that refuses any bearer token but
// settings.json's. Echo's KeyAuth middleware refuses a wrong key with 401 and the corpus asks for
// 403, so the middleware is the application's, returning Echo's own 403 error.
func authorizedRoutes(e *echo.Echo, p *Payloads) {
	e.GET("/authorized/small", func(c *echo.Context) error { return c.JSON(http.StatusOK, &p.Small) }, requireToken(p.Settings.Token))
}

// rb:wiring authorized.*
func requireToken(token string) echo.MiddlewareFunc {
	expected := "Bearer " + token
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			if c.Request().Header.Get(echo.HeaderAuthorization) != expected {
				return echo.ErrForbidden
			}
			return next(c)
		}
	}
}
