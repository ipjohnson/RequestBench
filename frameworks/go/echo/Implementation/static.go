package implementation

import (
	"github.com/labstack/echo/v5"
)

// staticRoutes serve the payload directory with e.Static, which registers GET /static* and hands
// each file to net/http's ServeContent.
func staticRoutes(e *echo.Echo, p *Payloads) {
	// rb:handler static.large,static.medium,static.small
	e.Static("/static", p.Directory)
}
