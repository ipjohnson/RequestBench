package implementation

import (
	"net/http"
	"strconv"
	"sync/atomic"

	"github.com/labstack/echo/v5"
)

// serial is x-rb-serial: one counter for the whole process. A handler that writes it
// increments it and writes the new value, so an answer the cache family replays carries the
// value it was stored with.
var serial atomic.Uint64

// fresh answers the payload and writes the next serial, which says the handler ran.
func fresh(payload *Payload) echo.HandlerFunc {
	return func(c *echo.Context) error {
		c.Response().Header().Set("x-rb-serial", strconv.FormatUint(serial.Add(1), 10))
		return c.JSON(http.StatusOK, payload)
	}
}
