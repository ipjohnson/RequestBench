// baseline: dispatch floor, no serialization.
package main

import (
	"runtime"
	"runtime/debug"

	"github.com/gofiber/fiber/v3"
)

// Fiber publishes no version constant, so it is read from the build info the linker
// embeds, which is where the Go targets get every other resolved version.
var fiberVersion = func() string {
	info, ok := debug.ReadBuildInfo()
	if !ok {
		return ""
	}
	for _, m := range info.Deps {
		if m.Path == "github.com/gofiber/fiber/v3" {
			return m.Version
		}
	}
	return ""
}()

// Built here rather than through _hosts.Meta, which is net/http: Fiber serves on fasthttp
// and shares none of that package's helpers.
func meta() fiber.Map {
	return fiber.Map{
		"framework": "fiber",
		"version":   fiberVersion,
		"runtime":   runtime.Version(),
		"adapter":   "",
		"template":  "html/template",
		"etag":      "fiber/middleware/etag strong sha1",
		"cache":     "fiber/middleware/cache in-memory",
	}
}

func registerBaseline(app *fiber.App) {
	app.Get("/plaintext", func(c fiber.Ctx) error { return c.SendString("Hello, World!") })

	app.Get("/health", func(c fiber.Ctx) error { return c.SendString("ok") })

	app.Get("/__meta", func(c fiber.Ctx) error { return c.JSON(meta()) })
}
