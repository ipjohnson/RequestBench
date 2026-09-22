package implementation

import (
	"net/http"
	"runtime"
	"runtime/debug"
	"strings"

	"github.com/gin-gonic/gin"
	ginjson "github.com/gin-gonic/gin/codec/json"
)

// contractRoutes answers /health and /__meta, which the contract asks of every framework
// outside the corpus.
func contractRoutes(r *gin.Engine) {
	// The payloads are loaded before the server listens, so a server that answers has them.
	r.GET("/health", func(c *gin.Context) { c.String(http.StatusOK, "ok") })

	version := ginVersion()
	r.GET("/__meta", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"framework": "Gin",
			"version":   version,
			"runtime":   runtime.Version(),
			"adapter":   "net/http",
			// The codec gin's build tags selected, as gin records it.
			"serializer": ginjson.Package,
			// Go sets this from the container's CPU quota, so it says how many threads run Go code.
			"gomaxprocs": runtime.GOMAXPROCS(0),
		})
	})
}

// ginVersion is the gin module the build resolved, without the v Go puts in front of it.
func ginVersion() string {
	if info, ok := debug.ReadBuildInfo(); ok {
		for _, dep := range info.Deps {
			if dep.Path == "github.com/gin-gonic/gin" {
				return strings.TrimPrefix(dep.Version, "v")
			}
		}
	}
	return strings.TrimPrefix(gin.Version, "v")
}
