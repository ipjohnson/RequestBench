// compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
//
// Fiber's own compress middleware, attached to these three routes alone. On the app it
// would put a "did the client ask?" check on all forty-five endpoints and contaminate the
// rows this family is measured against, which is why they have their own paths instead of
// riding on /json with an accept-encoding header.
package main

import (
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/compress"
	d "github.com/ianjohnson/requestbench/targets/go/_shared"
)

// Fiber names levels rather than taking a number. LevelBestSpeed and LevelBestCompression
// are the ends; Default is what zlib calls 6, which is the level every language is pinned
// to.
var gzip = compress.New(compress.Config{Level: compress.LevelDefault})

func compressedRoute(size string) fiber.Handler {
	body := d.Payload(size)
	return func(c fiber.Ctx) error {
		c.Set("x-rb-serial", d.NextSerial())
		return c.JSON(body)
	}
}

func registerCompressed(app *fiber.App) {
	// rb:snippet compressed.identity_small compressed.identity_medium compressed.identity_large
	// rb:snippet compressed.gzip_small compressed.gzip_medium compressed.gzip_large
	for _, size := range []string{"small", "medium", "large"} {
		route(app, fiber.MethodGet, "/compressed/"+size, gzip, compressedRoute(size))
	}
}
