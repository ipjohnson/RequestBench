package implementation

import (
	"net/http"
	"runtime"
	"runtime/debug"
	"strings"

	"github.com/labstack/echo/v5"
)

// contractRoutes answers /health and /__meta, which the contract asks of every framework
// outside the corpus.
func contractRoutes(e *echo.Echo) {
	// The payloads are loaded before the server listens, so a server that answers has them.
	e.GET("/health", func(c *echo.Context) error { return c.String(http.StatusOK, "ok") })

	version := echoVersion()
	e.GET("/__meta", func(c *echo.Context) error {
		return c.JSON(http.StatusOK, map[string]any{
			"framework": "Echo",
			"version":   version,
			"runtime":   runtime.Version(),
			"adapter":   "net/http",
			// Echo's default JSONSerializer encodes with encoding/json.
			"serializer": "encoding/json",
			// Go sets this from the container's CPU quota, so it says how many threads run Go code.
			"gomaxprocs": runtime.GOMAXPROCS(0),
		})
	})
}

// echoVersion is the echo module the build resolved, without the v Go puts in front of it.
func echoVersion() string {
	if info, ok := debug.ReadBuildInfo(); ok {
		for _, dep := range info.Deps {
			if dep.Path == "github.com/labstack/echo/v5" {
				return strings.TrimPrefix(dep.Version, "v")
			}
		}
	}
	return echo.Version
}
