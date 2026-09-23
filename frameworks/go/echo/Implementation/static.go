package implementation

import (
	"github.com/labstack/echo/v5"
)

// staticRoutes serve the payload directory with e.Static, which registers GET /static* and hands
// each file to net/http's ServeContent.
func staticRoutes(e *echo.Echo, p *Payloads) {
	// rb:handler static.file
	e.Static("/static", p.Directory)
}
