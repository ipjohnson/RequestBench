// cached: validator headers and the conditional request.
//
// The ETag is pinned in the fixture, so this measures emitting the header and comparing it
// rather than hashing the body. The size is closed over rather than read back out of the
// path, and the comparison requires a non-empty header: matching a missing if-none-match
// against an empty ETag answers 304 to a client that never asked a conditional question.
package main

import (
	"github.com/gofiber/fiber/v3"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

func validatorsFor(size string) fiber.Handler {
	etag := d.ETagOf(size)
	return func(c fiber.Ctx) error {
		c.Set("etag", etag)
		c.Set("cache-control", d.Cacheable)
		c.Set("x-rb-serial", d.NextSerial())
		if inm := c.Get("if-none-match"); inm != "" && inm == etag {
			return c.SendStatus(304)
		}
		return c.Next()
	}
}

func registerCached(app *fiber.App) {
	// rb:snippet cached.small cached.medium cached.large cached.revalidate
	for _, size := range []string{"small", "medium", "large"} {
		route(app, fiber.MethodGet, "/cached/"+size, validatorsFor(size), payload(size))
	}
}
