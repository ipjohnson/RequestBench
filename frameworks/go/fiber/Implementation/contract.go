package implementation

import (
	"runtime"
	"runtime/debug"
	"strings"

	"github.com/gofiber/fiber/v3"
)

// contractRoutes answers /health and /__meta, which the contract asks of every framework
// outside the corpus.
func contractRoutes(app *fiber.App) {
	// The payloads are loaded before the server listens, so a server that answers has them.
	app.Get("/health", func(c fiber.Ctx) error { return c.SendString("ok") })

	version := moduleVersion("github.com/gofiber/fiber/v3")
	app.Get("/__meta", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"framework": "Fiber",
			"version":   version,
			"runtime":   runtime.Version(),
			"adapter":   "fasthttp",
			// Fiber's JSONEncoder, which c.JSON calls, is encoding/json's Marshal unless the config names another.
			"serializer": "encoding/json",
			// Go sets this from the container's CPU quota, so it says how many threads run Go code.
			"gomaxprocs": runtime.GOMAXPROCS(0),
		})
	})
}

// moduleVersion is the version of a module the build resolved, without the v Go puts in front of it.
func moduleVersion(path string) string {
	if info, ok := debug.ReadBuildInfo(); ok {
		for _, dep := range info.Deps {
			if dep.Path == path {
				return strings.TrimPrefix(dep.Version, "v")
			}
		}
	}
	return "unknown"
}
