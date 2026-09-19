// baseline: dispatch floor, no serialization.
package main

import (
	"math"
	"runtime"
	"runtime/debug"
	"time"

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

// The boot clock _hosts keeps for the net/http targets, kept here for the same reason
// meta is. started is taken when the package initializes, before main runs, and boot is
// set in main once Fiber has its listener open.
var started = time.Now()
var boot time.Duration

// Built here rather than through _hosts.Meta, which is net/http: Fiber serves on fasthttp
// and shares none of that package's helpers.
func meta() fiber.Map {
	m := fiber.Map{
		"framework":  "fiber",
		"version":    fiberVersion,
		"runtime":    runtime.Version(),
		"adapter":    "",
		"serializer": "github.com/bytedance/sonic",
		"template":   "html/template",
		"etag":       "fiber/middleware/etag strong sha1",
		"cache":      "fiber/middleware/cache in-memory",
	}
	if boot > 0 {
		m["boot_ms"] = math.Round(float64(boot)/float64(100*time.Microsecond)) / 10
	}
	return m
}

func registerBaseline(app *fiber.App) {
	app.Get("/plaintext", func(c fiber.Ctx) error { return c.SendString("Hello, World!") })

	app.Get("/health", func(c fiber.Ctx) error { return c.SendString("ok") })

	app.Get("/__meta", func(c fiber.Ctx) error { return c.JSON(meta()) })
}
