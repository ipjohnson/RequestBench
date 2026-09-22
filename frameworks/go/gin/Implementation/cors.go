package implementation

import (
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// corsRoutes put gin-contrib/cors on the /cors group and nowhere else. It answers a preflight
// before any handler runs. The handler writes x-rb-serial, so its absence on a preflight shows
// the middleware answered alone.
func corsRoutes(r *gin.Engine, p *Payloads) {
	policy := p.Settings.Cors
	// rb:wiring cors.*
	group := r.Group("/cors", cors.New(cors.Config{
		AllowOrigins: []string{policy.Origin},
		AllowMethods: []string{policy.Method},
		AllowHeaders: []string{policy.Header},
		MaxAge:       time.Duration(policy.MaxAgeSeconds) * time.Second,
	}))
	// Gin runs a group's middleware only for a request a route of the group matched, so the
	// preflight needs an OPTIONS route. It has no handler of its own.
	group.OPTIONS("/small")
	// rb:end

	// rb:handler cors.request
	group.GET("/small", fresh(&p.Small))
}
