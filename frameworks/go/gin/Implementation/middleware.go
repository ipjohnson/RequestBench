package implementation

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// middlewareRoutes put no-op layers in front of the handler. A gin middleware is a HandlerFunc
// placed before the handler in the route's chain, so these layers are on these two routes alone.
func middlewareRoutes(r *gin.Engine, p *Payloads) {
	small := func(c *gin.Context) { c.JSON(http.StatusOK, &p.Small) }

	r.GET("/middleware/none", small)

	r.GET("/middleware/four", layered(4, small)...)

	r.GET("/middleware/sixteen", layered(16, small)...)
}

// rb:wiring middleware.*
// noop is one layer: it calls the next and does nothing else.
func noop(c *gin.Context) { c.Next() }

// layered is the handler behind count no-op layers, as the chain a route is registered with.
func layered(count int, handler gin.HandlerFunc) []gin.HandlerFunc {
	chain := make([]gin.HandlerFunc, count, count+1)
	for i := range chain {
		chain[i] = noop
	}
	return append(chain, handler)
}

// rb:end
