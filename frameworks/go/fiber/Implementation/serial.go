package implementation

import (
	"strconv"
	"sync/atomic"

	"github.com/gofiber/fiber/v3"
)

// serial is x-rb-serial: one counter for the whole process. A handler that writes it
// increments it and writes the new value, so an answer the cache family replays carries the
// value it was stored with.
var serial atomic.Uint64

// fresh answers the payload and writes the next serial, which says the handler ran.
func fresh(payload *Payload) fiber.Handler {
	return func(c fiber.Ctx) error {
		c.Set("x-rb-serial", strconv.FormatUint(serial.Add(1), 10))
		return c.JSON(payload)
	}
}
