// Package implementation is the RequestBench corpus answered by Gin. Each corpus family's
// routes are registered by a function of its own, in a file named for the family.
package implementation

import (
	"github.com/gin-gonic/gin"
)

// Router builds every route over the payloads, on an engine nothing serves yet, so the suite
// can hand it requests.
func Router(p *Payloads) *gin.Engine {
	r := gin.New()
	// gin.Default() without its request logger, which writes a line for every request.
	r.Use(gin.Recovery())

	contractRoutes(r)
	baselineRoutes(r)
	jsonRoutes(r, p)
	middlewareRoutes(r, p)
	parametersRoutes(r, p)
	queryRoutes(r, p)
	headersRoutes(r, p)
	bodyRoutes(r)
	authorizedRoutes(r, p)
	cacheRoutes(r, p)
	compressedRoutes(r, p)
	etagRoutes(r, p)
	templateRoutes(r, p)
	itemsRoutes(r, p)
	corsRoutes(r, p)
	formsRoutes(r, p)
	streamRoutes(r, p)
	sseRoutes(r, p)
	staticRoutes(r, p)
	return r
}
