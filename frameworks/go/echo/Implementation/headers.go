package implementation

import (
	"net/http"

	"github.com/labstack/echo/v5"
)

// HeadersBound is the three headers /headers/bind binds. The tags are in the canonical form
// net/http keys a header by, because Echo looks a tag up as it is written and otherwise compares
// it with every header the request carries.
type HeadersBound struct {
	Tenant    string `header:"X-Rb-Tenant" json:"tenant"`
	RequestID string `header:"X-Rb-Request-Id" json:"requestId"`
	Account   int    `header:"X-Rb-Account" json:"account"`
}

// headersRoutes: /headers reads no header, and /headers/bind binds three with echo.BindHeaders,
// the account as an integer. c.Bind never reads headers.
func headersRoutes(e *echo.Echo, p *Payloads) {
	e.GET("/headers", func(c *echo.Context) error { return c.JSON(http.StatusOK, &p.Small) })

	e.GET("/headers/bind", func(c *echo.Context) error {
		var bound HeadersBound
		if err := echo.BindHeaders(c, &bound); err != nil {
			return err
		}
		return c.JSON(http.StatusOK, Echoed[HeadersBound]{&p.Small, bound})
	})
}
