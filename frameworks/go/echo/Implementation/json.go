package implementation

import (
	"net/http"

	"github.com/labstack/echo/v5"
)

// jsonRoutes serialise a payload the framework already holds, at three sizes. c.JSON hands it to
// Echo's JSONSerializer, whose default encodes with encoding/json straight onto the response.
func jsonRoutes(e *echo.Echo, p *Payloads) {
	e.GET("/json/small", func(c *echo.Context) error { return c.JSON(http.StatusOK, &p.Small) })

	e.GET("/json/medium", func(c *echo.Context) error { return c.JSON(http.StatusOK, &p.Medium) })

	e.GET("/json/large", func(c *echo.Context) error { return c.JSON(http.StatusOK, &p.Large) })
}
